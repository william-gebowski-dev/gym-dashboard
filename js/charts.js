/**
 * js/charts.js — Pool de Chart.js + paleta
 *
 * Namespace: window.Charts
 *
 * A paleta categórica não é escolhida a olho. Os oito tons e a ORDEM deles
 * foram validados contra a superfície real dos cards (#101318) em:
 *   - pares adjacentes (barras, linhas, pilhas): CVD ΔE 8.7 · visão normal ΔE 19.3
 *   - todos os pares nos 3 primeiros slots (scatter): CVD ΔE 8.6 · visão normal 29.0
 * A ordem É o mecanismo de segurança para daltonismo — reordenar exige revalidar.
 * O vermelho lidera porque é a cor de identidade do app.
 *
 * Regra que gera mais confusão: um gráfico de UMA série usa sempre o slot 1.
 * Pintar cada gráfico de uma cor diferente gasta o canal de identidade sem
 * codificar nada — a cor passa a significar "qual card", não "qual série".
 */
window.Charts = (function () {
  const palette = {
    // Slots categóricos, ordem fixa. Nunca cicle além do oitavo: dobre a cauda
    // em "Outros" ou facete.
    series: ['#e66767', '#3987e5', '#008300', '#d55181', '#c98500', '#9085e9', '#d95926', '#199e70'],
    // Scatter/bubble: qualquer par pode encostar, então o teto validado é 3.
    scatterMax: 3,
    // Rampa sequencial de uma cor só para magnitude (heatmap), escuro→claro
    // no modo dark. Monotônica em L, degrau mais escuro a 2.10:1 da superfície.
    heat: ['#9a0000', '#bb0016', '#dd0033', '#fe324d'],
    // Status: significado reservado, nunca vira "série 4".
    status: { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' },
    grid: 'rgba(255, 255, 255, 0.07)',
    tick: '#aab2bd',
    text: '#f5f7fa',
    muted: '#89919d',
    surface: '#101318',
  };

  /** Mesma cor da série, mas como lavagem de área (~10%, nunca bloco saturado). */
  function wash(hex, alpha) {
    const a = Math.round((alpha ?? 0.1) * 255).toString(16).padStart(2, '0');
    return hex + a;
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = palette.tick;
    Chart.defaults.borderColor = palette.grid;
    Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation.duration = 220;

    // Legenda: presente sempre que houver 2+ séries. O texto usa token de
    // texto, nunca a cor do dado — quem carrega a identidade é o marcador.
    Chart.defaults.plugins.legend.labels.color = palette.text;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.boxHeight = 8;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
    Chart.defaults.plugins.legend.labels.padding = 14;

    Chart.defaults.plugins.tooltip.backgroundColor = '#151920';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.13)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = palette.text;
    Chart.defaults.plugins.tooltip.bodyColor = palette.tick;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxWidth = 8;
    Chart.defaults.plugins.tooltip.boxHeight = 8;
    Chart.defaults.plugins.tooltip.usePointStyle = true;

    // Specs de marca: barra fina com ponta arredondada, linha 2px,
    // marcador >= 8px de diâmetro com anel na cor da superfície.
    Chart.defaults.elements.bar.borderRadius = 4;
    Chart.defaults.elements.bar.borderSkipped = 'bottom';
    Chart.defaults.elements.line.borderWidth = 2;
    Chart.defaults.elements.line.capBezierPoints = true;
    Chart.defaults.elements.point.radius = 4;
    Chart.defaults.elements.point.hoverRadius = 6;
    Chart.defaults.elements.point.borderWidth = 2;
    Chart.defaults.elements.point.borderColor = palette.surface;
    Chart.defaults.elements.point.hitRadius = 12; // alvo de hover maior que a marca
  }

  /** Eixos recessivos: hairline sólida, nunca tracejada. */
  function axis(extra) {
    return {
      grid: { color: palette.grid, drawTicks: false, lineWidth: 1 },
      border: { display: false },
      ticks: { color: palette.tick, padding: 8 },
      ...extra,
    };
  }

  /**
   * Cria o chart na primeira chamada e atualiza dados/opções nas seguintes.
   *
   * A versão anterior fazia `if (exists) return chart` — o que silenciosamente
   * ignorava qualquer re-render. Era por isso que "Comparar Exercícios" nunca
   * reagia aos checkboxes.
   */
  function getOrCreateChart(canvasId, config) {
    const App = window.State.App;
    const existing = App.charts[canvasId];
    if (existing) {
      existing.data = config.data;
      // Object.assign muta o objeto de opções que o Chart.js já resolveu.
      // Trocá-lo por um spread quebra os descritores internos e derruba o
      // resolvedor de opções em recursão (_scriptable->_scriptable).
      if (config.options) Object.assign(existing.options, config.options);
      existing.update('none');
      return existing;
    }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    App.charts[canvasId] = new Chart(ctx, config);
    return App.charts[canvasId];
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

  return { palette, wash, axis, getOrCreateChart, destroySparklines };
})();
