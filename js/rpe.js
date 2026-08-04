/**
 * js/rpe.js — WorkoutSessionSet.json loader
 *
 * Namespace: window.RPE
 */
window.RPE = (function () {
  let cache = null;

  async function load() {
    if (cache) return cache;
    try {
      const res = await fetch('data/WorkoutSessionSet.json');
      if (!res.ok) {
        cache = [];
        return cache;
      }
      cache = await res.json();
      return cache;
    } catch (err) {
      console.warn('RPE.load falhou:', err);
      cache = [];
      return cache;
    }
  }

  function buildScatterData(sets, sessions) {
    const sessionById = new Map();
    for (const s of sessions) {
      const raw = s.rawSession ?? s;
      if (raw?.id) sessionById.set(raw.id, raw);
    }

    const byExercise = new Map();
    for (const set of sets) {
      if (!set.isComplete) continue;
      if (typeof set.rpe !== 'number' || typeof set.oneRepMax !== 'number') continue;
      if (!set.oneRepMax || set.oneRepMax <= 0) continue;
      const sessionId = set.workoutSessionExercise?.workoutSessionId;
      const session = sessionById.get(sessionId);
      const date = session?.startDate ? new Date(session.startDate) : null;
      const exName = set.workoutSessionExercise?.exercise?.name || 'Exercício';
      const pct = (set.weight / set.oneRepMax) * 100;
      if (!byExercise.has(exName)) byExercise.set(exName, []);
      byExercise.get(exName).push({
        x: pct,
        y: set.rpe,
        date,
        weight: set.weight,
        reps: set.reps,
      });
    }
    return [...byExercise.entries()]
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 8);
  }

  return { load, buildScatterData };
})();