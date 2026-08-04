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
    const prevAdh = computePeriodDelta(sessions, range, 'weeklyFreq', 'avg');

    const pct = vol.deltaPct;
    const curFreq = adh.weeklyFreq.toFixed(1);
    const prevFreq = Number.isFinite(prevAdh.previous) ? prevAdh.previous.toFixed(1) : '0.0';
    const freqDelta = Number.isFinite(prevAdh.previous)
      ? Math.abs((adh.weeklyFreq - prevAdh.previous).toFixed(1))
      : '0.0';

    // Sem base comparativa (previous=0) → texto neutro
    if (!vol.hasBase || !prevAdh.hasBase) {
      return window.I18N.t('summary.flat');
    }

    const isUp = pct > 0;
    const isDown = pct < 0;
    const freqDown = adh.weeklyFreq < prevAdh.previous;

    if (isUp && !freqDown) {
      return window.I18N.t('summary.improving', { pct: Math.abs(pct), freqDelta });
    }
    if (isUp && freqDown) {
      return window.I18N.t('summary.mixed', { pct: Math.abs(pct), prevFreq, curFreq });
    }
    if (isDown) {
      return window.I18N.t('summary.declining', { pct: Math.abs(pct), freqDelta });
    }
    return window.I18N.t('summary.flat');
  }

  return { render };
})();