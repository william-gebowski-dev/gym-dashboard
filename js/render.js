/**
 * js/render.js — Orquestrador de renderização
 *
 * Namespace: window.Render
 *
 * As seções pesadas moram em js/sections/ (Overview, Strength, Consistency);
 * aqui ficam o façade, o hero/range picker e os charts que não pertencem a
 * nenhuma delas (intensidade, comparação, medidas).
 *
 * Cores vêm de window.Charts.palette — a paleta validada. Não declare
 * constantes de cor locais: elas escapam da validação de contraste e CVD.
 *
 * Dependências: State, UI, Charts, Data, Intensity, TableView
 */
window.Render = (function () {
  const { App, applyRange } = window.State;
  const { getOrCreateChart, palette, wash, axis } = window.Charts;
  const { computePRs } = window.Data;

  /* Lazy charts ------------------------------------------------------------
   *
   * Um painel pode hospedar VÁRIOS canvases (a aba Força tem três). A versão
   * anterior guardava um único id em `box.dataset.chartId` e chamava
   * `unobserve()` depois de rodar o primeiro — então o segundo chart
   * registrado no mesmo painel nunca era criado, e "Top 10 por 1RM" ficava
   * como uma caixa vazia de 400 px.
   *
   * Agora cada painel tem um mapa de pendências, todas disparadas juntas, e o
   * painel fica marcado como visível para que re-renders futuros sejam
   * imediatos.
   */
  const pendingByBox = new Map(); // boxId -> Map(canvasId -> fn)
  const visibleBoxes = new Set();

  const chartObserver = (typeof IntersectionObserver !== 'function')
    ? null
    : new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          visibleBoxes.add(entry.target.id);
          flushBox(entry.target.id);
        }
      }, { rootMargin: '300px' });

  function flushBox(boxId) {
    const pending = pendingByBox.get(boxId);
    if (!pending || pending.size === 0) return;
    const fns = [...pending.values()];
    pending.clear();
    for (const fn of fns) fn();
  }

  function lazyChart(boxId, canvasId, fn) {
    const box = document.getElementById(boxId);
    if (!chartObserver || !box) { fn(); return; }
    if (visibleBoxes.has(boxId)) { fn(); return; }
    let pending = pendingByBox.get(boxId);
    if (!pending) {
      pending = new Map();
      pendingByBox.set(boxId, pending);
    }
    pending.set(canvasId, fn);
    chartObserver.observe(box); // idempotente para um alvo já observado
  }

  /* Façade das seções ----------------------------------------------------- */
  const renderKPIs = (sessions) => window.Overview.renderKPIs(sessions);
  const renderAdherence = (sessions) => window.Overview.renderAdherence(sessions);
  const renderVolumeChart = (sessions) => window.Strength.renderVolumeChart(sessions);
  const renderOneRmChart = (sessions) => window.Strength.renderOneRmChart(sessions);
  const renderWeekdayChart = (sessions) => window.Strength.renderWeekdayChart(sessions);
  const renderSessionsTable = (sessions) => window.Strength.renderSessionsTable(sessions);
  const renderHeatmap = (sessions) => window.Consistency.renderHeatmap(sessions);
  const renderPRs = () => window.Consistency.renderPRs();

  /* Hero e range picker --------------------------------------------------- */

  function renderHero() {
    // O host já existe no HTML, acima do card de resumo. Antes o picker era
    // pendurado no fim do <header>, caindo DEPOIS da conclusão que ele filtra.
    const host = document.getElementById('rangePickerHost');
    if (!host || host.children.length) return;
    host.appendChild(renderRangePicker());
    wireRangePicker();
  }

  function renderRangePicker() {
    const wrapper = document.createElement('div');
    wrapper.className = 'range-picker';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', 'Período');
    for (const n of ['all', '30', '90', '180', '365']) {
      const isAll = n === 'all';
      const btn = document.createElement('button');
      btn.className = 'range-btn';
      btn.dataset.range = n;
      btn.textContent = isAll ? 'Tudo' : `${n}d`;
      const active = App.range.label === (isAll ? 'all' : `${n}d`);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      wrapper.appendChild(btn);
    }
    return wrapper;
  }

  function wireRangePicker() {
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = btn.dataset.range;
        App.range = (n === 'all')
          ? { from: null, to: null, label: 'all' }
          : { from: window.State.daysAgoISO(Number(n)), to: null, label: `${n}d` };
        document.querySelectorAll('.range-btn').forEach(b => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        window.State.syncRangeToURL(App.range);
        window.dispatchEvent(new Event('gym:rangechange'));
      });
    });
  }

  /* Charts próprios ------------------------------------------------------- */

  function renderIntensityChart() {
    const canvas = document.getElementById('rpeChart');
    if (!canvas || !window.Intensity) return;
    const data = window.Intensity.buildScatterData(App.rawSessions);
    if (!data.length) { canvas.hidden = true; return; }
    canvas.hidden = false;

    // Num scatter qualquer par de pontos pode encostar, então o teto de cores
    // distinguíveis é 3 — não 8. Os demais viram uma nuvem de contexto em
    // cinza, que mostra a distribuição sem fingir identidade.
    const named = data.slice(0, palette.scatterMax);
    const rest = data.slice(palette.scatterMax);
    const datasets = named.map((g, i) => ({
      label: g.name,
      data: g.points,
      backgroundColor: palette.series[i],
      borderColor: palette.surface,
      borderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      order: 1,
    }));
    if (rest.length) {
      datasets.push({
        label: `Outros ${rest.length} exercícios`,
        data: rest.flatMap(g => g.points.map(p => ({ ...p, exercise: g.name }))),
        backgroundColor: 'rgba(137, 145, 157, 0.38)',
        borderColor: 'transparent',
        borderWidth: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        order: 2,
      });
    }

    getOrCreateChart('rpeChart', {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const name = ctx.raw.exercise || ctx.dataset.label;
                return `${name}: ${ctx.raw.weight}kg × ${ctx.raw.y} reps (${ctx.raw.x}% do melhor 1RM)`;
              },
            },
          },
        },
        scales: {
          x: axis({ title: { display: true, text: '% do melhor 1RM', color: palette.muted }, ticks: { color: palette.tick, padding: 8, callback: (v) => `${v}%` } }),
          y: axis({ title: { display: true, text: 'Repetições', color: palette.muted }, beginAtZero: true, ticks: { color: palette.tick, padding: 8, precision: 0 } }),
        },
      },
    });
    window.TableView?.register('rpeChart', {
      caption: 'Séries por percentual do melhor 1RM e repetições',
      seriesHeader: 'Exercício',
      xHeader: '% do melhor 1RM',
      yHeader: 'Repetições',
      formatValue: (v, kind) => (kind === 'x' ? `${v}%` : String(v)),
    });
  }

  function renderMeasurementsChart() {
    const canvas = document.getElementById('measurementsChart');
    const empty = document.getElementById('measurementsEmpty');
    if (!canvas || !window.Measurements) return;
    if (!App.measurementLogs) return;
    const points = window.Measurements.buildTimeline(App.measurements, App.measurementLogs);
    if (!points.length) {
      canvas.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    canvas.hidden = false;
    if (empty) empty.hidden = true;

    // Eixo de categoria com rótulos já formatados. Um eixo `type: 'time'`
    // exigiria chartjs-adapter-date-fns, que não é carregado — e sem ele o
    // Chart.js 4 não sabe interpretar datas.
    const byType = new Map();
    const dayKeys = new Set();
    for (const p of points) {
      const key = p.date.toISOString().slice(0, 10);
      dayKeys.add(key);
      if (!byType.has(p.type)) byType.set(p.type, new Map());
      byType.get(p.type).set(key, p.value);
    }
    const labels = [...dayKeys].sort();
    const datasets = [...byType.entries()].map(([type, series], i) => ({
      label: type,
      data: labels.map(k => series.get(k) ?? null),
      borderColor: palette.series[i % palette.series.length],
      backgroundColor: wash(palette.series[i % palette.series.length], 0.1),
      pointBackgroundColor: palette.series[i % palette.series.length],
      tension: 0.25,
      pointRadius: 0,
      pointHoverRadius: 6,
      spanGaps: true,
    }));

    getOrCreateChart('measurementsChart', {
      type: 'line',
      data: {
        labels: labels.map(k => new Date(`${k}T00:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })),
        datasets,
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: datasets.length > 1 } },
        scales: { x: axis({ grid: { display: false } }), y: axis() },
      },
    });
    window.TableView?.register('measurementsChart', {
      caption: 'Evolução das medidas corporais',
      labelHeader: 'Data',
    });
  }

  function renderComparisonChart() {
    const canvas = document.getElementById('comparisonChart');
    const select = document.getElementById('comparisonSelect');
    if (!canvas || !select) return;
    const prs = computePRs(App.rawSessions);
    if (!prs.length) { select.replaceChildren(); return; }

    if (!select.children.length) {
      const frag = document.createDocumentFragment();
      for (const pr of prs.slice(0, 12)) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = pr.name;
        input.addEventListener('change', renderComparisonChart);
        label.append(input, document.createTextNode(pr.name));
        frag.append(label);
      }
      select.replaceChildren(frag);
    }

    const checked = [...select.querySelectorAll('input:checked')].map(i => i.value).slice(0, 5);
    const hint = select.parentElement?.querySelector('.chart-empty');
    if (!checked.length) {
      canvas.hidden = true;
      if (!hint) {
        const p = document.createElement('p');
        p.className = 'modal-hint chart-empty';
        p.textContent = 'Selecione até 5 exercícios acima para comparar a evolução de carga.';
        canvas.after(p);
      }
      return;
    }
    canvas.hidden = false;
    hint?.remove();

    const allDates = new Set();
    const series = checked.map(name => {
      const pr = prs.find(p => p.name === name);
      const byDay = new Map();
      for (const h of pr?.history ?? []) {
        const k = h.date.toISOString().slice(0, 10);
        byDay.set(k, Math.max(byDay.get(k) || 0, h.weight));
      }
      byDay.forEach((_, k) => allDates.add(k));
      // A cor acompanha o EXERCÍCIO, não a posição na seleção. Indexar pela
      // ordem dos marcados fazia os sobreviventes trocarem de cor ao desmarcar
      // um item — quem aprendeu "leg press é vermelho" era enganado.
      const slot = prs.findIndex(p => p.name === name);
      return { name, byDay, color: palette.series[slot % palette.series.length] };
    });
    const labels = [...allDates].sort();

    getOrCreateChart('comparisonChart', {
      type: 'line',
      data: {
        labels: labels.map(k => new Date(`${k}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })),
        datasets: series.map(s => ({
          label: s.name,
          data: labels.map(k => s.byDay.get(k) ?? null),
          borderColor: s.color,
          backgroundColor: wash(s.color, 0.1),
          pointBackgroundColor: s.color,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 6,
          spanGaps: true,
        })),
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y} kg` } } },
        scales: {
          x: axis({ grid: { display: false }, ticks: { color: palette.tick, padding: 8, maxTicksLimit: 8 } }),
          y: axis({ title: { display: true, text: 'kg', color: palette.muted }, ticks: { color: palette.tick, padding: 8, callback: (v) => `${v} kg` } }),
        },
      },
    });
    window.TableView?.register('comparisonChart', {
      caption: 'Evolução de carga dos exercícios selecionados',
      labelHeader: 'Data',
      formatValue: (v) => `${v} kg`,
    });
  }

  function rerender() {
    const filtered = applyRange(App.sessions, App.range);
    renderKPIs(filtered);
    renderSessionsTable(filtered);
    renderAdherence(filtered);
    renderHeatmap(filtered);
    renderPRs();
    lazyChart('tab-strength', 'comparisonChart', renderComparisonChart);
    lazyChart('tab-overview', 'volumeChart', () => renderVolumeChart(filtered));
    lazyChart('tab-overview', 'weekdayChart', () => renderWeekdayChart(filtered));
    lazyChart('tab-strength', 'oneRmChart', () => renderOneRmChart(filtered));
    lazyChart('tab-strength', 'rpeChart', renderIntensityChart);
    lazyChart('tab-history', 'measurementsChart', renderMeasurementsChart);
  }

  return {
    renderKPIs, renderVolumeChart, renderOneRmChart, renderWeekdayChart,
    renderSessionsTable, renderAdherence, renderHeatmap, renderPRs,
    renderIntensityChart, renderMeasurementsChart, renderComparisonChart,
    renderHero, rerender,
  };
})();
