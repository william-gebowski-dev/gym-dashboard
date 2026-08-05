/**
 * js/sections/overview.js — KPIs + Adherence
 *
 * Namespace: window.Overview
 *
 * Funções extraídas de js/render.js (commit 5de7999) para isolar a
 * renderização da primeira dobra (KPIs e cards de aderência) em módulo
 * dedicado. Demais seções continuam em js/render.js.
 *
 * Dependências: State, UI, Data, I18N
 */
window.Overview = (function () {
  const { App } = window.State;
  const { kpiCard } = window.UI;
  const { computePeriodDelta, computeWeeklyAdherence, classifyPRs } = window.Data;
  const { t } = window.I18N;

  function buildDelta(d) {
    if (!d || !d.hasBase) return null;
    return {
      pct: d.deltaPct,
      direction: d.deltaPct > 0 ? 'up' : d.deltaPct < 0 ? 'down' : 'flat',
    };
  }

  function renderKPIs(sessions) {
    const sessionsDelta = computePeriodDelta(sessions, App.range, 'volume', 'count');
    const volumeDelta = computePeriodDelta(sessions, App.range, 'volume', 'sum');
    const adh = computeWeeklyAdherence(sessions, App.weeklyGoal);
    const prevAdh = computePeriodDelta(sessions, App.range, 'weeklyFreq', 'avg');

    const allPRs = window.Data.computePRs(App.rawSessions);
    const classified = classifyPRs(allPRs);
    const newPRs = classified.new.length;
    const newestPR = classified.new[0] || classified.evolving[0] || null;
    const prSub = newestPR
      ? { text: `Mais recente: ${newestPR.date.toLocaleDateString('pt-BR')}`, tone: 'up' }
      : { text: t('kpi.sub.newPRs'), tone: 'muted' };

    const container = document.getElementById('kpis');
    if (!container) return;
    container.replaceChildren(
      kpiCard(String(sessions.length), t('kpi.sessions'), buildDelta(sessionsDelta)),
      kpiCard(Math.round(volumeDelta.current).toLocaleString('pt-BR'), t('kpi.volume'), buildDelta(volumeDelta)),
      kpiCard(adh.weeklyFreq.toFixed(1), t('kpi.weeklyFreq'), buildDelta(prevAdh)),
      kpiCard(String(newPRs), t('kpi.newPRs'), null, prSub),
    );
  }

  function renderAdherence(sessions) {
    const adh = computeWeeklyAdherence(sessions, App.weeklyGoal);
    const goal = App.weeklyGoal;
    const container = document.getElementById('adherenceCards');
    if (!container) return;
    container.replaceChildren(
      kpiCard(String(adh.currentStreak), t('kpi.currentAdherence', { goal })),
      kpiCard(String(adh.longestStreak), t('kpi.longestAdherence')),
      kpiCard(`${adh.weeksHit}/${adh.totalWeeks}`, t('kpi.weeksHit')),
      kpiCard(adh.weeklyFreq.toFixed(1), t('kpi.weeklyAvg')),
    );
  }

  return { renderKPIs, renderAdherence, buildDelta };
})();
