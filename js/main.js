/**
 * js/main.js — Entry point
 *
 * Namespace: window.Main (orquestrador).
 *
 * Fluxo:
 * 1. Parse range da URL
 * 2. Render hero (range picker)
 * 3. Se file:// → dropzone
 * 4. fetch + populate App → rerender (uma única vez)
 * 5. Listener 'gym:rangechange' para re-render ao trocar range
 * 6. Init tabs + summary + timestamps
 */
window.Main = (function () {
  const { App, parseRangeFromURL } = window.State;
  const { loadAndAggregate } = window.Data;
  const { renderHero, rerender, renderMeasurementsChart } = window.Render;
  const { showFileDropZone } = window.Drop;
  const { summaryCard } = window.UI;

  function updateTimestamps(sessions) {
    App.loadedAt = new Date();
    const updatedEl = document.getElementById('updatedAt');
    if (updatedEl) {
      updatedEl.textContent = App.loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    const lastSession = sessions.at(-1);
    const lastEl = document.getElementById('lastWorkout');
    if (lastEl && lastSession) {
      lastEl.textContent = `${window.I18N.t('header.lastWorkout')}: ${lastSession.date.toLocaleDateString('pt-BR')}`;
    }
  }

  function renderSummary(sessions) {
    const slot = document.getElementById('summarySlot');
    if (!slot) return;
    const text = window.Summary.render(sessions, App.range);
    slot.replaceChildren(summaryCard(text));
  }

  async function main() {
    App.range = parseRangeFromURL();
    App.tab = window.State.parseTabFromURL();
    window.State.loadState?.();
    renderHero();

    if (location.protocol === 'file:') {
      showFileDropZone();
      return;
    }

    try {
      const { sessions, raw, sig } = await loadAndAggregate();
      App.sessions = sessions;
      App.rawSessions = raw;
      App.sourceSig = sig;
      updateTimestamps(sessions);
      renderSummary(sessions);
      // A tira usa o histórico completo de propósito: o filtro de período muda
      // a análise, não muda se você apareceu na segunda-feira passada.
      window.Streak?.render(sessions);
      rerender();
      window.Tabs.init();

      // Medidas são um arquivo pequeno e alimentam UM painel. Antes, cada fetch
      // secundário disparava um rerender() completo (~70 ms + 12 sparklines
      // recriadas); agora só o painel afetado é redesenhado.
      window.Measurements?.load().then(({ measurements, logs }) => {
        App.measurements = measurements;
        App.measurementLogs = logs;
        renderMeasurementsChart();
      }).catch(() => {});
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      const { kpiCard } = window.UI;
      const kpis = document.getElementById('kpis');
      if (kpis) {
        kpis.replaceChildren(
          kpiCard('!', window.I18N.t('error.load')),
        );
      }
      showFileDropZone();
      window.Tabs.init();
    }
  }

  window.addEventListener('gym:rangechange', () => {
    rerender();
    renderSummary(App.sessions);
    updateTimestamps(App.sessions);
    window.State.persistState?.();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();