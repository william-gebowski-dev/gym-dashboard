/**
 * js/main.js — Entry point
 *
 * Namespace: window.Main (orquestrador).
 *
 * Fluxo:
 * 1. Parse range da URL
 * 2. Render hero (range picker)
 * 3. Se file:// → dropzone
 * 4. fetch + populate App → rerender
 * 5. Listener 'gym:rangechange' para re-render ao trocar range
 * 6. Init tabs + summary + timestamps
 */
window.Main = (function () {
  const { App, parseRangeFromURL } = window.State;
  const { loadAndAggregate } = window.Data;
  const { renderHero, rerender } = window.Render;
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
    wireExportButtons();

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
      rerender();
      window.RPE?.load().then(sets => { App.rpeSets = sets; rerender(); }).catch(() => {});
      window.Coach?.load().then(workouts => { App.coachWorkouts = workouts; rerender(); }).catch(() => {});
      window.Measurements?.load().then(({ measurements, logs }) => {
        App.measurements = measurements;
        App.measurementLogs = logs;
        rerender();
      }).catch(() => {});
      window.Tabs.init();
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

  function wireExportButtons() {
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', async () => {
      try { await window.Export.toPNG(); } catch (e) { window.Toast?.show(e.message || 'Erro ao exportar', 'error'); }
    });
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.addEventListener('click', async () => {
      const res = await window.Export.shareURL();
      shareBtn.textContent = res.ok ? '✓' : '✗';
      setTimeout(() => { shareBtn.textContent = '🔗'; }, 1500);
    });
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