/**
 * js/muscles.js — Recência por grupo muscular
 *
 * Namespace: window.Muscles
 *
 * Função pura: entra a lista crua de sessões, sai quanto tempo faz que cada
 * grupo muscular foi treinado. É o que responde "o que treinar hoje" — o dado
 * já estava carregado, o app é que nunca perguntava isso a ele.
 *
 * 895 dos 899 exercícios do dataset têm primaryMuscleGroups; os 4 sem grupo
 * são ignorados em vez de virarem um grupo "desconhecido" que ninguém treina.
 */
window.Muscles = (function () {
  const DAY_MS = 86_400_000;

  /** Meia-noite local, para comparar dias de calendário e não instantes. */
  function midnight(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function recencyByGroup(rawSessions, now) {
    const hoje = midnight(now ?? new Date());
    const porGrupo = new Map(); // grupo -> { lastDate, contagem: Map(exercicio -> n) }

    for (const sessao of rawSessions ?? []) {
      const data = sessao.startDate ? new Date(sessao.startDate) : null;
      if (!data || Number.isNaN(data.getTime())) continue;

      for (const ex of sessao.workoutSessionExercises ?? []) {
        const nome = ex.exercise?.name;
        const grupos = ex.exercise?.primaryMuscleGroups ?? [];
        if (!nome || !grupos.length) continue;

        for (const g of grupos) {
          const grupo = g?.name;
          if (!grupo) continue;
          let registro = porGrupo.get(grupo);
          if (!registro) {
            registro = { lastDate: data, contagem: new Map() };
            porGrupo.set(grupo, registro);
          }
          if (data > registro.lastDate) registro.lastDate = data;
          registro.contagem.set(nome, (registro.contagem.get(nome) ?? 0) + 1);
        }
      }
    }

    return [...porGrupo.entries()]
      .map(([group, { lastDate, contagem }]) => ({
        group,
        lastDate,
        daysSince: Math.round((hoje - midnight(lastDate)) / DAY_MS),
        exercises: [...contagem.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([nome]) => nome),
      }))
      .sort((a, b) => b.daysSince - a.daysSince || a.group.localeCompare(b.group));
  }

  return { recencyByGroup };
})();
