/**
 * js/app.js — DEPRECATED
 *
 * A lógica foi refatorada em módulos ES-style (namespaces) sob js/:
 *   - state.js   → window.State  (App, filters, URL)
 *   - data.js    → window.Data   (fetch, normalize, compute)
 *   - charts.js  → window.Charts (Chart.js pool)
 *   - ui.js      → window.UI     (DOM primitives)
 *   - render.js  → window.Render (KPIs, charts, streak, heatmap, PRs)
 *   - drop.js    → window.Drop   (file:// fallback)
 *   - main.js    → entry point
 *
 * O entry real agora é js/main.js. Este arquivo existe para um shim
 * durante a migração; pode ser removido quando o index.html apontar
 * direto para main.js.
 */
console.info('js/app.js deprecated; use js/main.js');
