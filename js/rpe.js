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
    // WorkoutSessionSet.json não contém `date` nem `exerciseName` — apenas
    // {isComplete, weight, reps, oneRepMax, maxReps, minReps, restTime, set, ...}.
    // Sem essas chaves, não há como ancorar ponto a exercício/data reais.
    // Retornamos [] para exibir estado vazio elegante ("Sem dados de RPE")
    // em vez de inventar datas/nomes.
    if (!Array.isArray(sets)) return [];
    const sample = sets.find(s => s.isComplete) ?? sets[0];
    if (!sample) return [];
    const hasAnchor = ('date' in sample) || ('completedDate' in sample) ||
      ('workoutDate' in sample) || ('exerciseName' in sample);
    if (!hasAnchor) return [];
    // fallback legado se o JSON futuramente trouxer essas chaves
    const byExercise = new Map();
    for (const set of sets) {
      if (!set.isComplete) continue;
      if (typeof set.oneRepMax !== 'number' || set.oneRepMax <= 0) continue;
      const dateField = set.date ?? set.workoutDate ?? set.completedDate;
      const date = dateField ? new Date(dateField) : null;
      const exName = set.exerciseName || set.workoutSessionExercise?.exercise?.name;
      if (!exName) continue;
      const maxR = set.maxReps ?? 12;
      const rpeEstimate = Math.min(10, 6 + (1 - (set.reps / maxR)) * 4);
      const pct = (set.weight / set.oneRepMax) * 100;
      if (!byExercise.has(exName)) byExercise.set(exName, []);
      byExercise.get(exName).push({
        x: pct, y: Math.round(rpeEstimate * 10) / 10, date,
        weight: set.weight, reps: set.reps,
      });
    }
    return [...byExercise.entries()]
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, 8);
  }

  return { load, buildScatterData };
})();