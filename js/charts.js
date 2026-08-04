/**
 * js/charts.js — Pool de Chart.js
 *
 * Namespace: window.Charts
 *
 * Funções:
 * - getOrCreateChart(canvasId, config): cria uma vez; reutiliza em re-renders
 * - updateChart(canvasId, data, options): atualiza dados e força redraw silencioso
 * - destroySparklines(): remove charts pr-spark-* do pool (chamado em renderPRs)
 */
window.Charts = (function () {
  function getOrCreateChart(canvasId, config) {
    const App = window.State.App;
    if (App.charts[canvasId]) return App.charts[canvasId];
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    App.charts[canvasId] = new Chart(ctx, config);
    return App.charts[canvasId];
  }

  function updateChart(canvasId, data, options) {
    const App = window.State.App;
    const chart = App.charts[canvasId];
    if (!chart) return;
    chart.data = data;
    if (options) chart.options = { ...chart.options, ...options };
    chart.update('none');
  }

  function destroySparklines() {
    const App = window.State.App;
    for (const key of Object.keys(App.charts)) {
      if (key.startsWith('pr-spark-')) {
        App.charts[key].destroy();
        delete App.charts[key];
      }
    }
  }

  return { getOrCreateChart, updateChart, destroySparklines };
})();