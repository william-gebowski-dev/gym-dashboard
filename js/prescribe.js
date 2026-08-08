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
 *
 * TETO DE 10%: o incremento histórico é um bom palpite para exercícios de carga
 * alta, mas em exercícios de carga baixa, ou onde o usuário só registrou saltos
 * grandes, ele vira um salto perigoso. Caso real: "Panturrilha no leg press",
 * cujo menor incremento registrado é 20 kg — sobre 80 kg isso seria +25% num
 * treino só. Quando o incremento passa de 10% da carga atual, NÃO sugerimos
 * aumento: devolvemos `status: 'nosafe'` com `suggestedWeight` e `targetReps`
 * nulos, preenchendo `increment` para que a interface possa explicar por que
 * não há sugestão. Preferimos calar a arriscar: o usuário sempre pode subir a
 * carga por conta própria, mas não pode desfazer uma lesão.
 */
window.Prescribe = (function () {
  const DAY_MS = 86_400_000;
  const FAIXA_PADRAO = { min: 8, max: 12 };
  const INCREMENTO_PADRAO = 2.5;
  const LACUNA_MAXIMA_DIAS = 180;
  /** Fração da carga atual acima da qual um incremento deixa de ser seguro. */
  const TETO_INCREMENTO = 0.1;

  /**
   * Dia de calendário em UTC.
   *
   * UTC e não fuso local porque é a convenção já documentada do repositório
   * (ver README § "Por que UTC?" e startOfWeekUTC/isoDayUTC em js/data.js).
   * `startDate` é um epoch em milissegundos, ou seja, um instante sem fuso:
   * qual dia ele representa depende de quem pergunta. Comparar contra
   * meia-noite local faria a data escorregar de dia conforme o fuso de quem
   * roda — inclusive quebrando os testes em qualquer runner a leste de UTC.
   */
  function utcDay(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  /** Duas casas: pesos e incrementos vêm de subtrações com lixo de ponto flutuante. */
  function arredonda(n) {
    return Math.round(n * 100) / 100;
  }

  /**
   * Faixa de repetições da série, com 8–12 de padrão.
   *
   * A guarda é "número finito e positivo", não nullish: `maxReps: 0` aparece no
   * dataset e, se passasse, toda série satisfaria `reps >= 0` e o módulo subiria
   * a carga mirando zero repetições.
   */
  function faixa(set) {
    const valido = v => Number.isFinite(v) && v > 0;
    return {
      min: valido(set.minReps) ? set.minReps : FAIXA_PADRAO.min,
      max: valido(set.maxReps) ? set.maxReps : FAIXA_PADRAO.max,
    };
  }

  /** Séries que contam: concluídas, não-aquecimento, com peso e reps válidos. */
  function seriesDeTrabalho(ex) {
    return (ex.workoutSessionSets ?? []).filter(s =>
      s.isComplete && !s.warmUp &&
      typeof s.weight === 'number' && s.weight > 0 &&
      typeof s.reps === 'number' && s.reps > 0);
  }

  /**
   * Dias de treino em que o exercício aparece com trabalho real, mais antigo
   * primeiro.
   *
   * Agrega por DIA (UTC), não por entrada de exercício: o mesmo exercício pode
   * aparecer duas vezes na mesma sessão (acontece em 2025-07-16 com "Remada
   * cavalinho na máquina"). Sem agregar, os dois blocos viravam dois pontos com
   * a mesma data e `usualIncrement` media a diferença DENTRO do dia como se
   * fosse progressão entre treinos — e a "última" carga podia ser a do bloco
   * mais leve em vez da carga real do dia.
   */
  function historico(rawSessions, exerciseName) {
    const porDia = new Map();
    for (const sessao of rawSessions ?? []) {
      const data = sessao.startDate != null ? new Date(sessao.startDate) : null;
      if (!data || Number.isNaN(data.getTime())) continue;
      for (const ex of sessao.workoutSessionExercises ?? []) {
        if (ex.exercise?.name !== exerciseName) continue;
        const sets = seriesDeTrabalho(ex);
        if (!sets.length) continue;
        const chave = utcDay(data);
        const existente = porDia.get(chave);
        if (existente) {
          existente.sets.push(...sets);
          if (data < existente.date) existente.date = data;
        } else {
          porDia.set(chave, { date: data, sets: [...sets] });
        }
      }
    }
    return [...porDia.values()].sort((a, b) => a.date - b.date);
  }

  function usualIncrement(rawSessions, exerciseName) {
    const h = historico(rawSessions, exerciseName);
    let menor = null;
    for (let i = 1; i < h.length; i++) {
      const anterior = Math.max(...h[i - 1].sets.map(s => s.weight));
      const atual = Math.max(...h[i].sets.map(s => s.weight));
      const diferenca = arredonda(atual - anterior);
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
    const menorReps = Math.min(...noPeso.map(s => s.reps));

    const base = {
      lastDate: new Date(ultima.date),
      daysSince,
      lastWeight: peso,
      lastReps: menorReps,
      increment: null,
      suggestedWeight: null,
      targetReps: null,
    };

    // Data futura cai aqui junto com a lacuna longa: em ambos os casos não há
    // continuidade que justifique sugerir carga.
    if (daysSince < 0 || daysSince > LACUNA_MAXIMA_DIAS) return { ...base, status: 'stale' };

    // Cada série contra o SEU próprio topo: séries do mesmo peso podem ter
    // faixas diferentes, e usar a faixa de uma delas para todas fazia o módulo
    // subir carga com séries que não bateram o próprio topo.
    if (noPeso.every(s => s.reps >= faixa(s).max)) {
      const increment = usualIncrement(rawSessions, exerciseName);
      // Comparação multiplicada em vez de `peso * 0.1` para não depender da
      // representação binária de 0.1 na fronteira exata.
      if (increment * (1 / TETO_INCREMENTO) > peso) {
        return { ...base, status: 'nosafe', increment };
      }
      return {
        ...base,
        status: 'raise',
        increment,
        suggestedWeight: arredonda(peso + increment),
        targetReps: Math.min(...noPeso.map(s => faixa(s).min)),
      };
    }

    // Mira uma repetição a mais na série mais fraca ENTRE AS QUE AINDA TÊM
    // folga. Séries já no próprio topo estão fora: mirar nelas devolveria o
    // número de repetições que o usuário acabou de fazer.
    const comFolga = noPeso.filter(s => s.reps < faixa(s).max);
    const pior = comFolga.reduce((a, b) => (b.reps < a.reps ? b : a));
    return {
      ...base,
      status: 'hold',
      suggestedWeight: peso,
      targetReps: Math.min(pior.reps + 1, faixa(pior).max),
    };
  }

  return { usualIncrement, suggest };
})();
