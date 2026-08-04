/**
 * js/data.js — Fetch + normalize + compute
 *
 * Namespace: window.Data
 *
 * Funções:
 * - loadAndAggregate(): fetch Work JSON com memo por lastModified
 * - normalizeSession(s): shape → {id, name, date, durationMin, sets, volume, totalRestSec}
 * - computePRs(rawSessions): top 12 PRs com histórico
 * - computeStreak(sessions): {current, record, lastGap}
 */
window.Data = (function () {
  const aggregateCache = new Map();

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

  function computePeriodDelta(sessions, range, field, agg) {
    if (!sessions || sessions.length === 0) return { current: 0, previous: 0, deltaPct: 0 };
    agg = agg || 'sum';

    const from = range && range.from ? new Date(range.from) : null;
    const to = range && range.to ? new Date(range.to + 'T23:59:59') : new Date();
    const spanMs = (from ? from.getTime() : sessions[0].date.getTime()) - to.getTime();
    const absSpan = Math.abs(spanMs) || (Date.now() - sessions[0].date.getTime());

    const inRange = (d) => (!from || d >= from) && d <= to;
    const inPrev = (d) => {
      const prevTo = from || to;
      const prevFrom = new Date(prevTo.getTime() - absSpan);
      return d >= prevFrom && d < prevTo;
    };

    const aggregate = (xs) => {
      if (!xs.length) return 0;
      if (agg === 'avg') return xs.reduce((a, b) => a + b, 0) / xs.length;
      if (agg === 'count') return xs.length;
      return xs.reduce((a, b) => a + b, 0);
    };

    const currentVals = sessions.filter(s => inRange(s.date)).map(s => Number(s[field]) || 0);
    const prevVals = sessions.filter(s => inPrev(s.date)).map(s => Number(s[field]) || 0);

    const current = aggregate(currentVals);
    const previous = aggregate(prevVals);
    const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

    return { current, previous, deltaPct };
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

  function computeStreak(allSessions) {
    const dates = [...new Set(allSessions.map(s => s.date.toISOString().slice(0, 10)))].sort();
    if (dates.length === 0) return { current: 0, record: 0, lastGap: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let current = 0;
    let cursor = new Date(dates.at(-1));
    while (dates.includes(cursor.toISOString().slice(0, 10))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }

    let record = 0;
    let run = 0;
    let prev = null;
    for (const d of dates) {
      const day = new Date(d);
      if (prev && (day - prev) / 86_400_000 === 1) run++;
      else run = 1;
      record = Math.max(record, run);
      prev = day;
    }

    const lastDate = new Date(dates.at(-1));
    const lastGap = Math.floor((today - lastDate) / 86_400_000);
    return { current, record, lastGap };
  }

  return { loadAndAggregate, normalizeSession, computePRs, computeStreak, computePeriodDelta, computeWeeklyAdherence, classifyPRs };
})();
