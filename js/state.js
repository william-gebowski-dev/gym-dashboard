/**
 * js/state.js — Estado global + filtros URL
 *
 * Namespace: window.State (compatível file:// via <script> classic).
 *
 * Funções:
 * - applyRange(sessions, range): filtra sessões por data
 * - parseRangeFromURL(): lê ?from=&to=&days= da URL
 * - syncRangeToURL(range): escreve URL sem recarregar
 * - daysAgoISO(n): retorna ISO date de N dias atrás
 */
window.State = (function () {
  const App = {
    sessions: [],
    rawSessions: [],
    sourceSig: '',
    range: { from: null, to: null, label: 'all' },
    charts: {},
    tab: 'overview',
    weeklyGoal: 4,
    loadedAt: null,
  };

  function applyRange(sessions, range) {
    if (!range.from && !range.to) return sessions;
    const from = range.from ? new Date(range.from) : null;
    const to = range.to ? new Date(range.to + 'T23:59:59') : null;
    return sessions.filter(s => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      return true;
    });
  }

  function parseRangeFromURL() {
    const url = new URL(window.location.href);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const days = url.searchParams.get('days');
    if (from || to) return { from, to, label: 'custom' };
    if (days) return { from: daysAgoISO(Number(days)), to: null, label: `${days}d` };
    return { from: null, to: null, label: 'all' };
  }

  function syncRangeToURL(range) {
    const url = new URL(window.location.href);
    url.searchParams.delete('from');
    url.searchParams.delete('to');
    url.searchParams.delete('days');
    if (range.from && range.to) {
      url.searchParams.set('from', range.from);
      url.searchParams.set('to', range.to);
    } else if (range.from) {
      const days = Math.round((Date.now() - new Date(range.from)) / 86_400_000);
      url.searchParams.set('days', String(days));
    }
    window.history.replaceState({}, '', url);
  }

  function daysAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function parseTabFromURL() {
    const tab = new URLSearchParams(location.search).get('tab');
    return ['overview', 'strength', 'consistency', 'history'].includes(tab) ? tab : 'overview';
  }

  function syncTabToURL(name) {
    const url = new URL(location.href);
    if (url.searchParams.get('tab') === name) return;
    if (name === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', name);
    history.replaceState({}, '', url);
  }

  return { App, applyRange, parseRangeFromURL, syncRangeToURL, daysAgoISO, parseTabFromURL, syncTabToURL };
})();