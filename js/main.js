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
 */
window.Main = (function () {
  const { App, parseRangeFromURL } = window.State;
  const { loadAndAggregate } = window.Data;
  const { renderHero, rerender } = window.Render;
  const { showFileDropZone } = window.Drop;

  async function main() {
    App.range = parseRangeFromURL();
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
      rerender();
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      const { kpiCard } = window.UI;
      document.getElementById('kpis').replaceChildren(
        kpiCard('!', 'Erro ao carregar. Rode via servidor (python -m http.server).'),
      );
      showFileDropZone();
    }
  }

  window.addEventListener('gym:rangechange', () => rerender());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();