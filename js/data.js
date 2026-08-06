/**
 * js/data.js — Fetch + normalize + compute
 *
 * Namespace: window.Data
 *
 * Funções:
 * - loadAndAggregate(): fetch + normalize das sessões (memo em memória)
 * - normalizeSession(s): shape → {id, name, date, durationMin, sets, volume, totalRestSec}
 * - computePRs(rawSessions): top 12 PRs com histórico
 * - computePeriodDelta(sessions, range, field, agg): {current, previous, deltaPct}
 * - computeWeeklyAdherence(sessions, goal): {currentStreak, longestStreak, totalWeeks, weeksHit, weeklyFreq}
 * - classifyPRs(prs): {new, evolving, stagnant}
 */
window.Data = (function () {
  const aggregateCache = new Map();

  async function loadAndAggregate() {
    const path = 'data/WorkoutSession.json';
    const sig = path;
    if (aggregateCache.has(sig)) return aggregateCache.get(sig);

    const resp = await fetch(path);
    const raw = await resp.json();
    const sessions = raw.map(s => normalizeSession(s)).sort((a, b) => a.date - b.date);
    const summary = { sessions, raw, sig };
    aggregateCache.set(sig, summary);
    return summary;
  }

  function normalizeSession(s) {
    const exercises = s.workoutSessionExercises ?? [];
    let sets = 0;
    let volume = 0;
    let totalRestSec = 0;
    for (const ex of exercises) {
      for (const set of (ex.workoutSessionSets ?? [])) {
        if (!set.isComplete) continue;
        if (typeof set.weight !== 'number') continue;
        sets++;
        volume += set.weight * set.reps;
        totalRestSec += Number(set.restTime) || 0;
      }
    }
    let durationMin = null;
    if (s.startDate && s.endDate) {
      const ms = new Date(s.endDate) - new Date(s.startDate);
      if (ms > 0) durationMin = ms / 60_000;
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

  function computePRs(rawSessions) {
    const prs = new Map();
    for (const s of rawSessions) {
      const date = new Date(s.startDate);
      for (const ex of s.workoutSessionExercises ?? []) {
        const name = ex.exercise?.name;
        if (!name) continue;
        for (const set of ex.workoutSessionSets ?? []) {
          if (!set.isComplete) continue;
          if (typeof set.weight !== 'number' || set.weight <= 0) continue;
          const entry = prs.get(name) ?? { name, weight: 0, date: null, history: [] };
          entry.history.push({ date, weight: set.weight });
          if (set.weight > entry.weight) {
            entry.weight = set.weight;
            entry.date = date;
          }
          prs.set(name, entry);
        }
      }
    }
    return [...prs.values()].sort((a, b) => b.weight - a.weight).slice(0, 12);
  }

  /**
   * Compara o período selecionado com o período imediatamente anterior de mesma duração.
   *
   * Sem `range.from` (modo "Tudo") não existe período anterior: comparar o histórico
   * inteiro contra ele mesmo produzia deltas de 0–1% que pareciam informação e não eram.
   * Nesse caso devolvemos hasPrevious=false e a UI omite o badge.
   */
  function computePeriodDelta(sessions, range, field, agg) {
    const empty = { current: 0, previous: 0, deltaPct: 0, hasPrevious: false };
    if (!sessions || sessions.length === 0) return empty;
    agg = agg || 'sum';

    const from = range && range.from ? new Date(range.from) : null;
    const to = range && range.to ? new Date(range.to + 'T23:59:59') : new Date();

    const aggregateAll = (xs) => {
      if (!xs.length) return 0;
      if (agg === 'avg') return xs.reduce((a, b) => a + b, 0) / xs.length;
      if (agg === 'count') return xs.length;
      return xs.reduce((a, b) => a + b, 0);
    };

    if (!from) {
      return {
        current: aggregateAll(sessions.map(s => Number(s[field]) || 0)),
        previous: 0,
        deltaPct: 0,
        hasPrevious: false,
      };
    }

    const absSpan = Math.max(1, to.getTime() - from.getTime());
    const prevFrom = new Date(from.getTime() - absSpan);

    const inRange = (d) => d >= from && d <= to;
    const inPrev = (d) => d >= prevFrom && d < from;

    const current = aggregateAll(sessions.filter(s => inRange(s.date)).map(s => Number(s[field]) || 0));
    const previous = aggregateAll(sessions.filter(s => inPrev(s.date)).map(s => Number(s[field]) || 0));
    const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

    return { current, previous, deltaPct, hasPrevious: previous > 0 };
  }

  function computeWeeklyAdherence(sessions, goal) {
    goal = goal || 4;
    if (!sessions || sessions.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalWeeks: 0, weeksHit: 0, weeklyFreq: 0 };
    }

    const weekCounts = new Map();
    for (const s of sessions) {
      const d = s.date;
      const day = (d.getDay() + 6) % 7;
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
      const key = monday.toISOString().slice(0, 10);
      weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
    }

    const sortedWeeks = [...weekCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const weeksHit = sortedWeeks.filter(([, n]) => n >= goal).length;

    let currentStreak = 0;
    for (let i = sortedWeeks.length - 1; i >= 0; i--) {
      if (sortedWeeks[i][1] >= goal) currentStreak++;
      else break;
    }

    let longestStreak = 0, run = 0;
    for (const [, n] of sortedWeeks) {
      if (n >= goal) { run++; if (run > longestStreak) longestStreak = run; }
      else run = 0;
    }

    const totalWeeks = sortedWeeks.length || 1;
    const weeklyFreq = sessions.length / totalWeeks;

    return { currentStreak, longestStreak, totalWeeks, weeksHit, weeklyFreq };
  }

  function classifyPRs(prs) {
    const now = Date.now();
    const newPRs = [];
    const evolving = [];
    const stagnant = [];

    for (const pr of prs) {
      const days = pr.date ? Math.floor((now - pr.date.getTime()) / 86_400_000) : Infinity;
      const entry = { ...pr, _daysSince: days };
      if (days <= 30) newPRs.push(entry);
      else if (days <= 60) evolving.push(entry);
      else stagnant.push(entry);
    }

    return { new: newPRs, evolving, stagnant };
  }

  return { loadAndAggregate, normalizeSession, computePRs, computePeriodDelta, computeWeeklyAdherence, classifyPRs };
})();
