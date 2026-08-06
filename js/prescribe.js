/**
 * js/prescribe.js — Sugestão de carga por dupla progressão
 *
 * Namespace: window.Prescribe
 *
 * A regra NÃO foi inventada: é a que o próprio histórico mostra. 80% das séries
 * têm faixa de repetições explícita e a faixa é 8–12 em 2.323 de 2.359 casos; os
 * incrementos de carga realmente aplicados são +5, +1, +2 e +10 kg. Então a
 * sugestão segue a prática registrada, e o incremento sai do histórico DAQUELE
 * exercício em vez de um valor fixo escolhido por nós.
 *
 * Conservadora de propósito: sem histórico não sugere, e acima de 180 dias de
 * lacuna também não — a premissa de continuidade deixa de valer. Sugestão de
 * carga errada num app de treino é pior que nenhuma sugestão.
 */
window.Prescribe = (function () {
  const DAY_MS = 86_400_000;
  const FAIXA_PADRAO = { min: 8, max: 12 };
  const INCREMENTO_PADRAO = 2.5;
  const LACUNA_MAXIMA_DIAS = 180;

  /**
   * Dia de calendário em UTC.
   *
   * UTC e não fuso local porque é a convenção já documentada do repositório
   * (ver README § "Por que UTC?" e startOfWeekUTC/isoDayUTC em js/data.js):
   * `startDate` vem com `Z`, e comparar contra meia-noite local faria a data
   * escorregar de dia conforme o fuso de quem roda — inclusive quebrando os
   * testes em qualquer runner a leste de UTC+2.
   */
  function utcDay(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  /** Séries que contam: concluídas, não-aquecimento, com peso e reps válidos. */
  function seriesDeTrabalho(ex) {
    return (ex.workoutSessionSets ?? []).filter(s =>
      s.isComplete && !s.warmUp &&
      typeof s.weight === 'number' && s.weight > 0 &&
      typeof s.reps === 'number' && s.reps > 0);
  }

  /** Sessões em que o exercício aparece com trabalho real, mais antiga primeiro. */
  function historico(rawSessions, exerciseName) {
    const saida = [];
    for (const sessao of rawSessions ?? []) {
      const data = sessao.startDate ? new Date(sessao.startDate) : null;
      if (!data || Number.isNaN(data.getTime())) continue;
      for (const ex of sessao.workoutSessionExercises ?? []) {
        if (ex.exercise?.name !== exerciseName) continue;
        const sets = seriesDeTrabalho(ex);
        if (sets.length) saida.push({ date: data, sets });
      }
    }
    return saida.sort((a, b) => a.date - b.date);
  }

  function usualIncrement(rawSessions, exerciseName) {
    const h = historico(rawSessions, exerciseName);
    let menor = null;
    for (let i = 1; i < h.length; i++) {
      const anterior = Math.max(...h[i - 1].sets.map(s => s.weight));
      const atual = Math.max(...h[i].sets.map(s => s.weight));
      const diferenca = atual - anterior;
      if (diferenca > 0 && (menor === null || diferenca < menor)) menor = diferenca;
    }
    return menor ?? INCREMENTO_PADRAO;
  }

  function suggest(rawSessions, exerciseName, now) {
    const h = historico(rawSessions, exerciseName);
    if (!h.length) return null;

    const ultima = h[h.length - 1];
    const hoje = utcDay(now ?? new Date());
    const daysSince = Math.floor((hoje - utcDay(ultima.date)) / DAY_MS);

    const peso = Math.max(...ultima.sets.map(s => s.weight));
    const noPeso = ultima.sets.filter(s => s.weight === peso);
    const min = noPeso[0].minReps ?? FAIXA_PADRAO.min;
    const max = noPeso[0].maxReps ?? FAIXA_PADRAO.max;
    const menorReps = Math.min(...noPeso.map(s => s.reps));

    const base = {
      lastDate: ultima.date,
      daysSince,
      lastWeight: peso,
      lastReps: menorReps,
      increment: null,
      suggestedWeight: null,
      targetReps: null,
    };

    if (daysSince > LACUNA_MAXIMA_DIAS) return { ...base, status: 'stale' };

    if (noPeso.every(s => s.reps >= max)) {
      const increment = usualIncrement(rawSessions, exerciseName);
      return {
        ...base,
        status: 'raise',
        increment,
        suggestedWeight: Math.round((peso + increment) * 100) / 100,
        targetReps: min,
      };
    }

    return {
      ...base,
      status: 'hold',
      suggestedWeight: peso,
      targetReps: Math.min(menorReps + 1, max),
    };
  }

  return { usualIncrement, suggest };
})();
