/**
 * js/muscles.js — Recência por grupo muscular
 *
 * Namespace: window.Muscles
 *
 * Função pura: entra a lista crua de sessões, sai quanto tempo faz que cada
 * grupo muscular foi treinado. É o que responde "o que treinar hoje" — o dado
 * já estava carregado, o app é que nunca perguntava isso a ele.
 *
 * 895 das 899 entradas de exercício do dataset têm primaryMuscleGroups; as 4 sem
 * grupo são ignoradas em vez de virarem um grupo "desconhecido" que ninguém treina.
 *
 * Datas em UTC, seguindo a convenção do repositório (ver "Por que UTC?" no
 * README e `startOfWeekUTC`/`isoDayUTC` em js/data.js): `startDate` é ISO 8601
 * com `Z`, e em fuso local o treino das 22h escorrega de dia — para o usuário no
 * Brasil vira "amanhã", em Tóquio vira outro dia ainda. Contando em dias UTC o
 * resultado é o mesmo em qualquer fuso e não depende de DST (por isso `floor`,
 * não `round`: sem DST todo intervalo é múltiplo exato de 24h).
 *
 * O módulo é autocontido de propósito — não reusa `window.Data` para que o
 * harness de teste precise carregar um arquivo só.
 */
window.Muscles = (function () {
  const DAY_MS = 86_400_000;

  /** Meia-noite UTC como timestamp, para comparar dias de calendário e não instantes. */
  function utcMidnight(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  function recencyByGroup(rawSessions, now) {
    const hoje = utcMidnight(now ?? new Date());
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
        daysSince: Math.floor((hoje - utcMidnight(lastDate)) / DAY_MS),
        exercises: [...contagem.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([nome]) => nome),
      }))
      .sort((a, b) => b.daysSince - a.daysSince || a.group.localeCompare(b.group));
  }

  return { recencyByGroup };
})();
