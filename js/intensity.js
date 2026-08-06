/**
 * js/intensity.js — Dispersão de intensidade das séries
 *
 * Namespace: window.Intensity
 *
 * Substitui o antigo js/rpe.js, que baixava data/WorkoutSessionSet.json (1 MB)
 * para plotar um "RPE" inexistente nos dados: era `6 + (1 - reps/maxReps) * 4`,
 * uma função determinística de reps apresentada como esforço percebido medido.
 *
 * Cuidado ao ler o campo `oneRepMax` do dataset: ele é estimado POR SÉRIE por
 * uma fórmula que depende apenas das repetições — 30 kg × 12 e 35 kg × 12 dão
 * ambos 69,4%. Dividir weight por ele devolveria de novo só uma função de reps.
 *
 * Por isso a referência aqui é o MELHOR 1RM estimado do exercício em todo o
 * histórico. Assim o eixo X responde à carga de verdade: uma série de 100 kg
 * num exercício cujo melhor é 150 kg aparece em 67%, e a mesma série depois de
 * o atleta evoluir aparece mais à esquerda.
 */
window.Intensity = (function () {
  const MAX_SERIES = 8;

  /**
   * @param {Array} rawSessions sessões cruas de WorkoutSession.json
   * @returns {Array<{name: string, points: Array}>} até 8 exercícios, os mais frequentes
   */
  function buildScatterData(rawSessions) {
    const sessions = rawSessions ?? [];

    // Passo 1: melhor 1RM estimado por exercício, em todo o histórico.
    const bestOneRm = new Map();
    for (const session of sessions) {
      for (const ex of session.workoutSessionExercises ?? []) {
        const name = ex.exercise?.name;
        if (!name) continue;
        for (const set of ex.workoutSessionSets ?? []) {
          if (typeof set.oneRepMax !== 'number' || set.oneRepMax <= 0) continue;
          bestOneRm.set(name, Math.max(bestOneRm.get(name) ?? 0, set.oneRepMax));
        }
      }
    }

    // Passo 2: cada série concluída vira um ponto (% do melhor 1RM, repetições).
    const byExercise = new Map();
    for (const session of sessions) {
      const date = session.startDate ? new Date(session.startDate) : null;
      for (const ex of session.workoutSessionExercises ?? []) {
        const name = ex.exercise?.name;
        if (!name) continue;
        const reference = bestOneRm.get(name);
        if (!reference) continue;
        for (const set of ex.workoutSessionSets ?? []) {
          if (!set.isComplete) continue;
          if (typeof set.weight !== 'number' || set.weight <= 0) continue;
          if (typeof set.reps !== 'number' || set.reps <= 0) continue;
          if (!byExercise.has(name)) byExercise.set(name, []);
          byExercise.get(name).push({
            x: Math.round((set.weight / reference) * 1000) / 10,
            y: set.reps,
            weight: set.weight,
            date,
          });
        }
      }
    }

    return [...byExercise.entries()]
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points.length - a.points.length)
      .slice(0, MAX_SERIES);
  }

  return { buildScatterData };
})();
