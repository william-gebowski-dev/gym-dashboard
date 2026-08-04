/**
 * js/data.js — Fetch + normalize + compute
 *
 * Namespace: window.Data
 *
 * Funções puras testáveis (exportadas):
 * - toNumber(value)
 * - epley1RM(weight, reps)
 * - pickOneRepMax(set)
 * - startOfWeekUTC(date)
 * - isoDayUTC(date)
 * - applyRangeFilter(sessions, range)
 * - normalizeSession(s)
 * - computeVolume(input)
 * - computePRs(rawSessions)
 * - computePeriodDelta(sessions, range, field, agg)
 * - computeWeeklyAdherence(sessions, goal)
 * - classifyPRs(prs)
 */
window.Data = (function () {
  const aggregateCache = new Map();

  // ──────────────────────────── primitivos numéricos / datas
  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value == null) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  /** Fórmula de Epley: w * (1 + r/30) — referência clássica para 1RM estimado. */
  function epley1RM(weight, reps) {
    const w = toNumber(weight);
    const r = toNumber(reps);
    if (w <= 0 || r <= 0) return 0;
    return w * (1 + r / 30);
  }

  /** Usa o `oneRepMax` do JSON se válido; senão cai para Epley. */
  function pickOneRepMax(set) {
    const raw = toNumber(set?.oneRepMax);
    if (raw > 0) return raw;
    return epley1RM(set?.weight, set?.reps);
  }

  /** Segunda-feira UTC da semana ISO de `date`. */
  function startOfWeekUTC(date) {
    const d = (date instanceof Date) ? new Date(date) : new Date(date);
    if (isNaN(d)) return null;
    const day = (d.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  }

  /** YYYY-MM-DD em UTC — imutável ao fuso horário do usuário. */
  function isoDayUTC(date) {
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10);
  }

  // ──────────────────────────── fetch + memo
  async function loadAndAggregate() {
    const path = 'data/WorkoutSession.json';
    let sig = path;
    try {
      const head = await fetch(path, { method: 'HEAD' });
      const lm = head.headers.get('last-modified');
      if (lm) sig = `${path}@${lm}`;
    } catch { /* CORS/HEAD pode falhar em file://; cai no body */ }

    if (aggregateCache.has(sig)) return aggregateCache.get(sig);

    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ao buscar ${path}`);
    const raw = await resp.json();
    if (!Array.isArray(raw)) throw new Error(`${path} deve ser array de sessões`);
    const sessions = raw.map(s => normalizeSession(s)).sort((a, b) => a.date - b.date);
    const summary = { sessions, raw, sig };
    aggregateCache.set(sig, summary);
    return summary;
  }

  /** Filtra sessões pelo range {from, to} (YYYY-MM-DD). Imutável, UTC. */
  function applyRangeFilter(sessions, range) {
    if (!sessions) return [];
    if (!range || (!range.from && !range.to)) return sessions.slice();
    const from = range.from ? new Date(range.from + 'T00:00:00Z') : null;
    const to = range.to ? new Date(range.to + 'T23:59:59.999Z') : null;
    return sessions.filter(s => {
      if (!s.date || isNaN(s.date)) return false;
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      return true;
    });
  }

  function normalizeSession(s) {
    const exercises = s.workoutSessionExercises ?? [];
    let sets = 0;
    let volume = 0;
    let totalRestSec = 0;
    for (const ex of exercises) {
      for (const set of (ex.workoutSessionSets ?? [])) {
        if (!set.isComplete) continue;
        const w = toNumber(set.weight);
        const r = toNumber(set.reps);
        if (w <= 0) continue;
        sets++;
        volume += w * r;
        totalRestSec += toNumber(set.restTime);
      }
    }
    let durationMin = null;
    if (s.startDate && s.endDate) {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      const ms = end - start;
      // ignora outliers (>8h) por timezone malformado
      if (ms > 0 && ms < 8 * 3600 * 1000) durationMin = Math.round(ms / 60_000);
    }
    return {
      id: s.id,
      name: s.name,
      date: new Date(s.startDate),
      durationMin,
      exercises: exercises.length,
      sets,
      volume,
      totalRestSec,
    };
  }

  /** Volume total de uma sessão normalizada ou array delas. */
  function computeVolume(input) {
    if (Array.isArray(input)) return input.reduce((acc, s) => acc + toNumber(s.volume), 0);
    return toNumber(input?.volume);
  }

  function computePRs(rawSessions) {
    const prs = new Map();
    for (const s of rawSessions) {
      const date = new Date(s.startDate);
      if (isNaN(date)) continue;
      const exercises = s.workoutSessionExercises ?? [];
      for (const ex of exercises) {
        const name = ex.exercise?.name;
        if (!name) continue;
        for (const set of ex.workoutSessionSets ?? []) {
          if (!set.isComplete) continue;
          const oneRm = pickOneRepMax(set);
          if (oneRm <= 0) continue;
          const entry = prs.get(name) ?? { name, weight: 0, date: null, history: [] };
          entry.history.push({ date, weight: oneRm });
          if (oneRm > entry.weight) {
            entry.weight = oneRm;
            entry.date = date;
          }
          prs.set(name, entry);
        }
      }
    }
    return [...prs.values()].sort((a, b) => b.weight - a.weight).slice(0, 12);
  }

  /**
   * Compara `field` entre período atual e imediatamente anterior.
   * Retorna `deltaPct = null` e `hasBase = false` quando não há base
   * comparativa (previous=0), permitindo UI mostrar "Sem base comparativa".
   */
  function computePeriodDelta(sessions, range, field, agg) {
    if (!sessions || sessions.length === 0) {
      return { current: 0, previous: 0, deltaPct: null, hasBase: false };
    }
    agg = agg || 'sum';

    const sortedTimes = sessions.map(s => s.date.getTime()).sort((a, b) => a - b);
    const dataStart = sortedTimes[0];
    const dataEnd = sortedTimes[sortedTimes.length - 1];
    const dataSpan = Math.max(dataEnd - dataStart, 7 * 86_400_000);

    const from = (range && range.from) ? new Date(range.from + 'T00:00:00Z') : null;
    const to = (range && range.to) ? new Date(range.to + 'T23:59:59.999Z') : new Date();
    const requestedSpan = from ? (to.getTime() - from.getTime()) : dataSpan;
    const absSpan = requestedSpan > 0 ? requestedSpan : dataSpan;

    const inRange = (d) => (!from || d >= from) && d <= to;
    const inPrev = (d) => {
      const prevTo = from || new Date(dataEnd + 86_400_000);
      const prevFrom = new Date(prevTo.getTime() - absSpan);
      return d >= prevFrom && d < prevTo;
    };

    const aggregate = (xs) => {
      if (!xs.length) return 0;
      if (agg === 'avg') return xs.reduce((a, b) => a + b, 0) / xs.length;
      if (agg === 'count') return xs.length;
      return xs.reduce((a, b) => a + b, 0);
    };

    const pickField = (s) => Number.isFinite(s[field]) ? s[field] : 0;

    const currentVals = sessions.filter(s => inRange(s.date)).map(pickField);
    const prevVals = sessions.filter(s => inPrev(s.date)).map(pickField);

    const current = aggregate(currentVals);
    const previous = aggregate(prevVals);
    const hasBase = previous > 0;
    const deltaPct = hasBase ? Math.round(((current - previous) / previous) * 100) : null;

    return { current, previous, deltaPct, hasBase };
  }

  function computeWeeklyAdherence(sessions, goal) {
    goal = goal || 4;
    if (!sessions || sessions.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalWeeks: 0, weeksHit: 0, weeklyFreq: 0, inProgressWeek: false };
    }

    const weekCounts = new Map();
    const currentWeekKey = isoDayUTC(startOfWeekUTC(new Date()));
    for (const s of sessions) {
      const key = isoDayUTC(startOfWeekUTC(s.date));
      weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
    }

    const sortedWeeks = [...weekCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const totalWeeks = sortedWeeks.length;
    const weeksHit = sortedWeeks.filter(([, n]) => n >= goal).length;

    // streak atual: semanas CONCLUÍDAS (anteriores à corrente) que bateram a meta
    let currentStreak = 0;
    for (let i = sortedWeeks.length - 1; i >= 0; i--) {
      const [key, n] = sortedWeeks[i];
      if (key === currentWeekKey) continue;
      if (n >= goal) currentStreak++;
      else break;
    }

    // semana em andamento só conta como ativa se ainda não bateu meta
    const inProgressCount = weekCounts.get(currentWeekKey) ?? 0;
    const inProgressWeek = inProgressCount > 0 && inProgressCount < goal;

    let longestStreak = 0, run = 0;
    for (const [key, n] of sortedWeeks) {
      if (key === currentWeekKey) continue;
      if (n >= goal) { run++; if (run > longestStreak) longestStreak = run; }
      else run = 0;
    }

    const weeklyFreq = totalWeeks > 0 ? sessions.length / totalWeeks : 0;

    return { currentStreak, longestStreak, totalWeeks, weeksHit, weeklyFreq, inProgressWeek, currentWeekKey };
  }

  function classifyPRs(prs) {
    const now = Date.now();
    const newPRs = [];
    const evolving = [];
    const stagnant = [];
    for (const pr of prs) {
      if (!pr.date) {
        stagnant.push(pr);
        continue;
      }
      const days = (now - pr.date.getTime()) / 86_400_000;
      if (days <= 30) newPRs.push(pr);
      else if (days <= 90) evolving.push(pr);
      else stagnant.push(pr);
    }
    return { new: newPRs, evolving, stagnant };
  }

  return {
    toNumber, epley1RM, pickOneRepMax, startOfWeekUTC, isoDayUTC,
    applyRangeFilter, normalizeSession, computeVolume, computePRs,
    computePeriodDelta, computeWeeklyAdherence, classifyPRs,
    loadAndAggregate, _resetAggregateCache: () => aggregateCache.clear(),
  };
})();