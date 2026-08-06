/**
 * js/summary.js — Geração de resumo textual automático
 *
 * Namespace: window.Summary
 */
window.Summary = (function () {
  function render(sessions, range) {
    if (!sessions || sessions.length === 0) {
      return window.I18N.t('summary.empty');
    }
    const { computePeriodDelta, computeWeeklyAdherence } = window.Data;
    const vol = computePeriodDelta(sessions, range, 'volume', 'sum');
    const adh = computeWeeklyAdherence(sessions);

    // Sem período selecionado não existe intervalo anterior para comparar.
    // A versão antiga comparava o histórico inteiro com ele mesmo e concluía
    // "desempenho estável" — sempre, para qualquer dataset.
    if (!vol.hasPrevious) {
      const dates = sessions.map(s => s.date).sort((a, b) => a - b);
      return window.I18N.t('summary.all', {
        sessions: sessions.length,
        first: dates[0].toLocaleDateString('pt-BR'),
        last: dates.at(-1).toLocaleDateString('pt-BR'),
        volume: Math.round(vol.current).toLocaleString('pt-BR'),
        freq: adh.weeklyFreq.toFixed(1),
      });
    }

    const prevAdh = computePeriodDelta(sessions, range, 'weeklyFreq', 'avg');
    const pct = vol.deltaPct;
    const curFreq = adh.weeklyFreq.toFixed(1);
    const prevFreq = prevAdh.previous.toFixed(1);
    const freqDelta = Math.abs((adh.weeklyFreq - prevAdh.previous).toFixed(1));
    const freqDown = adh.weeklyFreq < prevAdh.previous;

    if (pct > 0 && !freqDown) {
      return window.I18N.t('summary.improving', { pct: Math.abs(pct), freqDelta });
    }
    if (pct > 0 && freqDown) {
      return window.I18N.t('summary.mixed', { pct: Math.abs(pct), prevFreq, curFreq });
    }
    if (pct < 0) {
      return window.I18N.t('summary.declining', { pct: Math.abs(pct), freqDelta });
    }
    return window.I18N.t('summary.flat');
  }

  return { render };
})();
