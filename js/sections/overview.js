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
    // Os deltas precisam do histórico COMPLETO: `sessions` já vem filtrado pelo
    // período, então procurar o intervalo anterior dentro dele nunca acha nada
    // e todo KPI ficava sem badge.
    const all = App.sessions;
    const sessionsDelta = computePeriodDelta(all, App.range, 'volume', 'count');
    const volumeDelta = computePeriodDelta(all, App.range, 'volume', 'sum');
    const perSessionDelta = computePeriodDelta(all, App.range, 'volume', 'avg');
    const adh = computeWeeklyAdherence(sessions, App.weeklyGoal);

    const classified = classifyPRs(window.Data.computePRs(App.rawSessions));
    const newestPR = classified.new[0] || classified.evolving[0] || classified.stagnant[0] || null;
    // O contador de novos PRs dá 0 na maioria dos períodos; o subtítulo com a
    // data do recorde mais recente é o que torna o card informativo.
    const prSub = newestPR
      ? { text: `Mais recente: ${newestPR.date.toLocaleDateString('pt-BR')}`, tone: classified.new.length ? 'up' : 'muted' }
      : { text: t('kpi.sub.newPRs'), tone: 'muted' };

    const container = document.getElementById('kpis');
    if (!container) return;
    container.replaceChildren(
      kpiCard(String(sessions.length), t('kpi.sessions'), buildDelta(sessionsDelta)),
      kpiCard(Math.round(volumeDelta.current).toLocaleString('pt-BR'), t('kpi.volume'), buildDelta(volumeDelta)),
      kpiCard(Math.round(perSessionDelta.current).toLocaleString('pt-BR'), t('kpi.volumePerSession'), buildDelta(perSessionDelta)),
      kpiCard(String(classified.new.length), t('kpi.newPRs'), null, prSub),
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
