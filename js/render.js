/**
 * js/render.js — Renderização de KPIs, charts, streak, heatmap, PRs, tabela
 *
 * Namespace: window.Render
 *
 * Dependências: State, UI, Charts, Data
 */
window.Render = (function () {
  const { App, applyRange } = window.State;
  const { getOrCreateChart } = window.Charts;
  const { computePeriodDelta, computeWeeklyAdherence, classifyPRs } = window.Data;

  // Constantes semânticas de cor. Mesmas do :root em css/styles.css.
  // Sections (overview/strength/consistency) leem via window.CHART_COLORS.
  const CHART_COLORS = Object.freeze({
    accent:    '#ff405d',  // volume, destaque principal
    positive:  '#32d583',  // frequência, meta atingida
    strength:  '#4d8dff',  // 1RM, força
    warning:   '#fdb022',  // atenção, queda
    previous:  '#89919d',  // período anterior
    extra:     '#a855f7',  // série adicional
    extra2:    '#06b6d4',  // série adicional 2
    grid:      'rgba(255,255,255,0.06)',
    text:      '#f7f8fa',
    muted:     '#8d95a3',
  });
  // Paleta cíclica para séries múltiplas (RPE scatter, comparison).
  const SERIES_PALETTE = [
    CHART_COLORS.accent,
    CHART_COLORS.positive,
    CHART_COLORS.strength,
    CHART_COLORS.warning,
    CHART_COLORS.extra,
    CHART_COLORS.extra2,
    '#ec4899',
    '#f97316',
  ];
  // Expor global para sections e outros módulos.
  window.CHART_COLORS = CHART_COLORS;
  window.SERIES_PALETTE = SERIES_PALETTE;

  // Lazy load: chart boxes ficam com data-chart-id, chart criado só quando visível
  const chartRegistry = new Map(); // chartId -> creator fn
  const chartObserver = (typeof IntersectionObserver !== 'function')
    ? null
    : new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const box = entry.target;
          const id = box.dataset.chartId;
          const fn = chartRegistry.get(id);
          if (fn) {
            fn();
            chartRegistry.delete(id);
            chartObserver.unobserve(box);
          }
        }
      }, { rootMargin: '300px' });

  function lazyChart(boxId, canvasId, fn) {
    if (!chartObserver) { fn(); return; }
    const box = document.getElementById(boxId);
    if (!box) return;
    box.dataset.chartId = canvasId;
    chartRegistry.set(canvasId, fn);
    chartObserver.observe(box);
  }
  const { computePRs } = window.Data;
  const { t } = window.I18N;

  function renderKPIs(sessions) {
    // Delegado para window.Overview (extraído em commit pós-refactor).
    // Mantido como shim para preservar a API pública de window.Render.
    return window.Overview.renderKPIs(sessions);
  }

  function renderAdherence(sessions) {
    return window.Overview.renderAdherence(sessions);
  }

  function renderVolumeChart(sessions) {
    // Delegado para window.Strength (extraído em commit pós-refactor).
    // Mantido como shim para preservar a API pública de window.Render.
    return window.Strength.renderVolumeChart(sessions);
  }

  function renderOneRmChart(sessions) {
    return window.Strength.renderOneRmChart(sessions);
  }

  function renderWeekdayChart(sessions) {
    return window.Strength.renderWeekdayChart(sessions);
  }

  function renderSessionsTable(sessions) {
    return window.Strength.renderSessionsTable(sessions);
  }

  function renderHeatmap(sessions) {
    // Delegado para window.Consistency (extraído em commit pós-refactor).
    // Mantido como shim para preservar a API pública de window.Render.
    return window.Consistency.renderHeatmap(sessions);
  }

  function renderPRs() {
    return window.Consistency.renderPRs();
  }

  function renderHero() {
    const hero = document.querySelector('header.hero');
    if (!hero.querySelector('.range-picker')) {
      const wrap = document.createElement('div');
      wrap.style.marginTop = '20px';
      wrap.appendChild(renderRangePicker());
      hero.appendChild(wrap);
      wireRangePicker();
    }
  }

  function renderRangePicker() {
    const wrapper = document.createElement('div');
    wrapper.className = 'range-picker';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', 'Período');
    for (const n of ['all', '30', '90', '180', '365']) {
      const label = n === 'all' ? 'Tudo' : `${n}d`;
      const active = App.range.label === (n === 'all' ? 'all' : `${n}d`) ? 'active' : '';
      const btn = document.createElement('button');
      btn.className = `range-btn ${active}`.trim();
      btn.dataset.range = n;
      btn.textContent = label;
      wrapper.appendChild(btn);
    }
    return wrapper;
  }

  function wireRangePicker() {
    const events = window.State; // alias
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = btn.dataset.range;
        if (n === 'all') {
          App.range = { from: null, to: null, label: 'all' };
        } else {
          App.range = { from: window.State.daysAgoISO(Number(n)), to: null, label: `${n}d` };
        }
        window.State.syncRangeToURL(App.range);
        window.dispatchEvent(new Event('gym:rangechange'));
      });
    });
  }

  function renderRPEChart() {
    const canvas = document.getElementById('rpeChart');
    if (!canvas || !window.RPE) return;
    if (!App.rpeSets) return;
    if (App.rpeSets.length === 0) {
      const hint = canvas.parentElement?.querySelector('.rpe-empty');
      if (!hint) {
        const p = document.createElement('p');
        p.className = 'modal-hint rpe-empty';
        p.textContent = 'Sem dados suficientes para plotar.';
        canvas.style.display = 'none';
        canvas.parentElement?.append(p);
      }
      return;
    }
    const data = window.RPE.buildScatterData(App.rpeSets, App.rawSessions);
    if (!data.length) {
      // exibe estado vazio se ainda não houver
      if (!canvas.parentElement?.querySelector('.rpe-empty')) {
        const p = document.createElement('p');
        p.className = 'modal-hint rpe-empty';
        p.textContent = 'Sem dados suficientes para plotar RPE — JSON de sets sem ancoragem temporal.';
        canvas.style.display = 'none';
        canvas.parentElement?.append(p);
      }
      return;
    }
    // restaura canvas se antes estava oculto
    canvas.style.display = '';
    canvas.parentElement?.querySelector('.rpe-empty')?.remove();
    const colors = SERIES_PALETTE;
    getOrCreateChart('rpeChart', {
      type: 'scatter',
      data: {
        datasets: data.map((g, i) => ({
          label: g.name,
          data: g.points,
          backgroundColor: colors[i % colors.length],
          borderColor: colors[i % colors.length],
          pointRadius: 3,
          pointHoverRadius: 5,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#f4f4f5', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = ctx.raw;
                return `${ctx.dataset.label}: ${p.weight}kg×${p.reps} (${p.x.toFixed(0)}% 1RM, RPE ${p.y})`;
              },
            },
          },
        },
        scales: {
          x: { title: { display: true, text: '% de 1RM', color: '#a1a1aa' }, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a1a1aa' } },
          y: { title: { display: true, text: 'RPE', color: '#a1a1aa' }, min: 5, max: 10, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a1a1aa' } },
        },
      },
    });
  }

  function renderCoachAdherence() {
    const container = document.getElementById('coachList');
    if (!container || !window.Coach) return;
    if (!App.coachWorkouts) {
      container.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'modal-hint', textContent: 'Carregando…',
      }));
      return;
    }
    const rows = window.Coach.computeAdherence(App.coachWorkouts, App.rawSessions);
    if (!rows.length) {
      container.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'modal-hint', textContent: 'Sem dados de coach disponíveis.',
      }));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'coach-row';
      const week = document.createElement('div');
      week.className = 'coach-week';
      week.textContent = r.week;
      const barWrap = document.createElement('div');
      barWrap.className = 'coach-bar';
      const fill = document.createElement('div');
      fill.className = 'coach-bar-fill';
      if (r.adherencePct === null) {
        fill.style.width = `${Math.min(100, (r.completed / 4) * 100)}%`;
        if (r.completed >= 4) fill.classList.add('high');
      } else {
        fill.style.width = `${r.adherencePct}%`;
        if (r.adherencePct >= 80) fill.classList.add('high');
        else if (r.adherencePct < 50) fill.classList.add('low');
      }
      barWrap.append(fill);
      const pct = document.createElement('div');
      pct.className = 'coach-pct';
      pct.textContent = r.adherencePct === null
        ? `${r.completed}/4`
        : `${r.adherencePct}%`;
      row.append(week, barWrap, pct);
      frag.append(row);
    }
    container.replaceChildren(frag);
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
    const byType = new Map();
    for (const p of points) {
      if (!byType.has(p.type)) byType.set(p.type, []);
      byType.get(p.type).push({ x: p.date, y: p.value });
    }
    const palette = SERIES_PALETTE;
    const datasets = [...byType.entries()].map(([type, data], i) => ({
      label: type,
      data,
      borderColor: palette[i % palette.length],
      backgroundColor: palette[i % palette.length] + '33',
      tension: 0.25,
      pointRadius: 3,
    }));
    getOrCreateChart('measurementsChart', {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#f4f4f5' } } },
        scales: {
          x: { type: 'time', time: { unit: 'month' }, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a1a1aa' } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a1a1aa' } },
        },
      },
    });
  }

  function renderComparisonChart() {
    const canvas = document.getElementById('comparisonChart');
    const select = document.getElementById('comparisonSelect');
    if (!canvas || !select) return;
    const prs = computePRs(App.rawSessions);
    if (!prs.length) {
      select.replaceChildren();
      return;
    }
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
    if (!checked.length) {
      getOrCreateChart('comparisonChart', { type: 'line', data: { labels: [], datasets: [] }, options: { plugins: { legend: { display: false } } } });
      return;
    }
    const palette = SERIES_PALETTE;
    const allDates = new Set();
    const datasets = checked.map((name, i) => {
      const pr = prs.find(p => p.name === name);
      const points = (pr?.history ?? []).map(h => ({
        x: h.date.toISOString().slice(0, 10),
        y: h.weight,
      }));
      points.forEach(p => allDates.add(p.x));
      return {
        label: name,
        data: points,
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length] + '22',
        tension: 0.25,
        pointRadius: 2,
      };
    });
    const labels = [...allDates].sort();
    getOrCreateChart('comparisonChart', {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#f4f4f5' } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a1a1aa' } },
          y: { title: { display: true, text: 'kg', color: '#a1a1aa' }, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#a1a1aa' } },
        },
      },
    });
  }

  function rerender() {
    const filtered = applyRange(App.sessions, App.range);
    renderKPIs(filtered);
    lazyChart('tab-overview', 'volumeChart', () => renderVolumeChart(filtered));
    renderWeekdayChart(filtered);
    renderSessionsTable(filtered);
    renderAdherence(filtered);
    renderHeatmap(filtered);
    renderPRs();
    lazyChart('tab-strength', 'oneRmChart', () => renderOneRmChart(filtered));
    lazyChart('tab-strength', 'rpeChart', () => renderRPEChart());
    renderCoachAdherence();
    lazyChart('tab-history', 'measurementsChart', () => renderMeasurementsChart());
    renderComparisonChart();
  }

  return {
    renderKPIs, renderVolumeChart, renderOneRmChart, renderWeekdayChart,
    renderSessionsTable, renderAdherence, renderHeatmap, renderPRs,
    renderRPEChart, renderCoachAdherence, renderMeasurementsChart, renderComparisonChart,
    renderHero, rerender,
  };
})();
