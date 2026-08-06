/**
 * js/render.js — Renderização de KPIs, charts, streak, heatmap, PRs, tabela
 *
 * Namespace: window.Render
 *
 * Dependências: State, UI, Charts, Data, Intensity
 */
window.Render = (function () {
  const { App, applyRange } = window.State;
  const { kpiCard, spanText, prCard, prBadge, sessionCard, openSessionModal } = window.UI;
  const { getOrCreateChart, destroySparklines, palette, wash, axis } = window.Charts;

  /* Lazy charts ------------------------------------------------------------
   *
   * Um painel pode hospedar VÁRIOS canvases (a aba Força tem três). A versão
   * anterior guardava um único id em `box.dataset.chartId` e chamava
   * `unobserve()` depois de rodar o primeiro — então o segundo chart registrado
   * no mesmo painel nunca era criado. Era por isso que "Top 10 por 1RM" ficava
   * como uma caixa vazia de 400 px.
   *
   * Agora cada painel tem um mapa de pendências, todas disparadas juntas, e o
   * painel fica marcado como visível para que re-renders futuros sejam imediatos.
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

  const { computePRs, computePeriodDelta, computeWeeklyAdherence, classifyPRs } = window.Data;
  const { t } = window.I18N;

  const nf = (n) => Math.round(n).toLocaleString('pt-BR');

  function relativeDays(days) {
    if (!Number.isFinite(days)) return '—';
    if (days <= 1) return 'ontem';
    if (days < 30) return `há ${days} dias`;
    if (days < 365) return `há ${Math.round(days / 30)} meses`;
    const years = days / 365;
    return years < 1.5 ? 'há 1 ano' : `há ${Math.round(years)} anos`;
  }

  /** Converte um delta em props de badge, ou null quando não há base de comparação. */
  function buildDelta(d) {
    if (!d || !d.hasBase) return null;
    return {
      pct: d.deltaPct,
      direction: d.deltaPct > 0 ? 'up' : d.deltaPct < 0 ? 'down' : 'flat',
    };
  }

  function renderKPIs(sessions) {
    // Os deltas precisam do histórico COMPLETO: `sessions` já vem filtrado pelo
    // período, então procurar o intervalo anterior dentro dele nunca acha nada.
    const all = App.sessions;
    const sessionsDelta = computePeriodDelta(all, App.range, 'volume', 'count');
    const volumeDelta = computePeriodDelta(all, App.range, 'volume', 'sum');
    const perSessionDelta = computePeriodDelta(all, App.range, 'volume', 'avg');
    const adh = computeWeeklyAdherence(sessions, App.weeklyGoal);

    const container = document.getElementById('kpis');
    if (!container) return;
    container.replaceChildren(
      kpiCard(String(sessions.length), t('kpi.sessions'), buildDelta(sessionsDelta)),
      kpiCard(nf(volumeDelta.current), t('kpi.volume'), buildDelta(volumeDelta)),
      kpiCard(adh.weeklyFreq.toFixed(1), t('kpi.weeklyFreq'), null),
      // Antes: "Novos Recordes", que dava 0 em todo período por depender de PRs
      // dos últimos 30 dias. Volume por treino sempre diz algo sobre o período.
      kpiCard(nf(perSessionDelta.current), t('kpi.volumePerSession'), buildDelta(perSessionDelta)),
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

  function renderVolumeChart(sessions) {
    const monthlyData = {};
    for (const s of sessions) {
      const key = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + s.volume;
    }
    const labels = Object.keys(monthlyData);
    // Série única → slot 1. A cor aqui não codifica nada além de "é o dado".
    const datasets = [{
      label: 'Volume (kg)',
      data: Object.values(monthlyData),
      backgroundColor: palette.series[0],
      maxBarThickness: 24,
    }];

    if (App.range?.from) {
      const from = new Date(App.range.from);
      const spanMs = (sessions.length ? sessions.at(-1).date - from : Date.now() - from);
      const prevFrom = new Date(from.getTime() - spanMs);
      const prevMonthly = {};
      for (const s of App.sessions) {
        if (s.date < prevFrom || s.date >= from) continue;
        const key = `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, '0')}`;
        prevMonthly[key] = (prevMonthly[key] || 0) + s.volume;
      }
      const shiftKey = (key, shift) => {
        const [y, m] = key.split('-').map(Number);
        const d = new Date(y, m - 1 + shift, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };
      const shift = (labels.length - Object.keys(prevMonthly).length);
      const prevData = labels.map(l => prevMonthly[shiftKey(l, -shift)] ?? null);
      // Uma legenda que anuncia uma série que não desenha nada é ruído. Só
      // entra quando há pelo menos dois pontos para formar linha.
      if (prevData.filter(v => v !== null).length >= 2) {
        // Linha de referência, não uma segunda identidade: fica em cinza de
        // texto para não gastar um slot categórico no que é só "o antes".
        datasets.push({
          label: 'Período anterior',
          data: prevData,
          type: 'line',
          borderColor: palette.muted,
          borderDash: [4, 4],
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: palette.muted,
          tension: 0.25,
          spanGaps: false,
        });
      }
    }

    getOrCreateChart('volumeChart', {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${nf(c.parsed.y)} kg` } },
        },
        scales: {
          y: axis({ beginAtZero: true, ticks: { color: palette.tick, padding: 8, callback: (v) => nf(v) } }),
          x: axis({ grid: { display: false } }),
        },
      },
    });
    window.TableView?.register('volumeChart', {
      caption: 'Volume mensal em quilogramas',
      labelHeader: 'Mês',
      formatValue: (v) => `${nf(v)} kg`,
    });
  }

  function renderOneRmChart() {
    const exerciseMax = {};
    for (const s of App.rawSessions) {
      for (const ex of s.workoutSessionExercises ?? []) {
        const name = ex.exercise?.name;
        if (!name) continue;
        let best = 0;
        for (const set of ex.workoutSessionSets ?? []) {
          if (typeof set.weight !== 'number') continue;
          const oneRm = set.weight * (1 + set.reps / 30);
          if (oneRm > best) best = oneRm;
        }
        exerciseMax[name] = Math.max(exerciseMax[name] || 0, best);
      }
    }
    const top = Object.entries(exerciseMax).sort(([, a], [, b]) => b - a).slice(0, 10);
    getOrCreateChart('oneRmChart', {
      type: 'bar',
      data: {
        labels: top.map(([n]) => n),
        datasets: [{
          label: '1RM Estimado (kg)',
          data: top.map(([, v]) => Math.round(v)),
          backgroundColor: palette.series[0],
          maxBarThickness: 20,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${nf(c.parsed.x)} kg` } },
        },
        scales: {
          x: axis({ beginAtZero: true, ticks: { color: palette.tick, padding: 8, callback: (v) => `${v} kg` } }),
          y: axis({ grid: { display: false } }),
        },
      },
    });
    window.TableView?.register('oneRmChart', {
      caption: 'Dez exercícios com maior 1RM estimado',
      labelHeader: 'Exercício',
      formatValue: (v) => `${nf(v)} kg`,
    });
  }

  function renderWeekdayChart(sessions) {
    const counts = new Array(7).fill(0);
    for (const s of sessions) counts[s.date.getDay()]++;
    getOrCreateChart('weekdayChart', {
      type: 'bar',
      data: {
        labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        datasets: [{
          label: 'Sessões',
          data: counts,
          backgroundColor: palette.series[0],
          maxBarThickness: 24,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.parsed.y} ${c.parsed.y === 1 ? 'treino' : 'treinos'}` } },
        },
        scales: {
          y: axis({ beginAtZero: true, ticks: { color: palette.tick, padding: 8, precision: 0 } }),
          x: axis({ grid: { display: false } }),
        },
      },
    });
    window.TableView?.register('weekdayChart', {
      caption: 'Número de treinos por dia da semana',
      labelHeader: 'Dia',
      formatValue: (v) => `${v} treinos`,
    });
  }

  function renderSessionsTable(sessions) {
    const recent = sessions.slice(-10).reverse();
    const tbody = document.querySelector('#sessionsTable tbody');
    const cards = document.getElementById('sessionsCards');
    if (tbody) tbody.replaceChildren();
    if (cards) cards.replaceChildren();

    for (const s of recent) {
      const summary = {
        id: s.id,
        date: s.date,
        name: s.name,
        exercisesCount: s.exercises,
        setsCount: s.sets,
        volume: s.volume,
      };
      if (tbody) {
        const tr = document.createElement('tr');
        tr.dataset.sessionId = s.id || '';
        tr.tabIndex = 0;
        for (const value of [
          s.date.toLocaleDateString('pt-BR'),
          s.name || 'Treino',
          String(s.exercises ?? 0),
          String(s.sets ?? 0),
          `${nf(s.volume)} kg`,
        ]) {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        }
        tr.addEventListener('click', () => openSessionModal(summary));
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSessionModal(summary); }
        });
        tbody.appendChild(tr);
      }
      if (cards) cards.appendChild(sessionCard(summary));
    }
  }

  function renderHeatmap(sessions) {
    const dailyVolume = {};
    const sessionByDay = new Map();
    for (const s of sessions) {
      const d = s.date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyVolume[key] = (dailyVolume[key] || 0) + s.volume;
      if (!sessionByDay.has(key)) sessionByDay.set(key, s);
    }
    const container = document.getElementById('heatmap');
    if (!container) return;
    const max = Math.max(0, ...Object.values(dailyVolume));
    const sortedDates = Object.keys(dailyVolume).sort();
    container.replaceChildren();
    if (sortedDates.length === 0) return;

    const start = new Date(`${sortedDates[0]}T00:00:00`);
    const end = new Date(`${sortedDates.at(-1)}T00:00:00`);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const frag = document.createDocumentFragment();

    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const monthWrap = document.createElement('div');
      monthWrap.className = 'heat-month';
      const label = document.createElement('div');
      label.className = 'heat-month-label';
      label.textContent = `${monthNames[month]}/${String(year).slice(2)}`;
      monthWrap.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'heat-grid';
      for (let i = 0; i < new Date(year, month, 1).getDay(); i++) {
        const blank = document.createElement('div');
        blank.className = 'heat-cell is-blank';
        grid.appendChild(blank);
      }
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const vol = dailyVolume[dateStr];
        const label = new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR');
        // Dia com treino vira botão: o heatmap deixa de ser só decorativo e
        // abre a sessão daquele dia, igual às linhas do histórico.
        const cell = document.createElement(vol ? 'button' : 'div');
        cell.className = 'heat-cell';
        if (vol) {
          const session = sessionByDay.get(dateStr);
          cell.type = 'button';
          cell.dataset.level = String(Math.max(1, Math.min(4, Math.ceil((vol / max) * 4))));
          cell.title = `${label}: ${nf(vol)} kg`;
          cell.setAttribute('aria-label', `${label}, ${nf(vol)} kg. Abrir treino.`);
          if (session) {
            cell.addEventListener('click', () => openSessionModal({
              id: session.id,
              date: session.date,
              name: session.name,
              exercisesCount: session.exercises,
              setsCount: session.sets,
              volume: session.volume,
            }));
          }
        } else {
          cell.title = `${label}: sem treino`;
        }
        grid.appendChild(cell);
      }
      monthWrap.appendChild(grid);
      frag.appendChild(monthWrap);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    container.appendChild(frag);
  }

  function renderPRs() {
    const prs = computePRs(App.rawSessions);
    const classified = classifyPRs(prs);
    const grid = document.getElementById('prGrid');
    if (!grid) return;
    destroySparklines();
    grid.replaceChildren();
    if (prs.length === 0) {
      grid.textContent = 'Nenhum PR registrado ainda.';
      return;
    }

    const groups = [
      [t('pr.group.new'), classified.new, 'new'],
      [t('pr.group.evolving'), classified.evolving, 'evolving'],
      [t('pr.group.stagnant'), classified.stagnant, 'stagnant'],
    ].filter(([, items]) => items.length > 0);

    // Com um grupo só, o cabeçalho já diz o status: repetir a badge em cada
    // card seria a mesma palavra doze vezes.
    const showBadges = groups.length > 1;

    for (const [label, items, status] of groups) {
      const heading = document.createElement('div');
      heading.className = 'pr-group-heading';
      heading.textContent = label;
      grid.appendChild(heading);

      for (const pr of items) {
        const card = prCard(pr);

        const meta = document.createElement('div');
        meta.className = 'pr-meta';
        const dateStr = pr.date ? pr.date.toLocaleDateString('pt-BR') : '—';
        meta.append(
          spanText(`${dateStr} · ${relativeDays(pr._daysSince)}`),
          spanText(' · '),
          spanText(`${pr.history.length} séries`),
        );
        card.appendChild(meta);
        if (showBadges) card.appendChild(prBadge(status));

        const canvas = document.createElement('canvas');
        canvas.className = 'pr-sparkline';
        canvas.height = 28;
        card.appendChild(canvas);
        grid.appendChild(card);

        const sessionsMax = new Map();
        for (const h of pr.history) {
          const k = h.date.toISOString().slice(0, 10);
          sessionsMax.set(k, Math.max(sessionsMax.get(k) || 0, h.weight));
        }
        const points = [...sessionsMax.entries()].sort(([a], [b]) => a.localeCompare(b));

        if (points.length >= 2) {
          const canvasId = `pr-spark-${grid.children.length}`;
          canvas.id = canvasId;
          getOrCreateChart(canvasId, {
            type: 'line',
            data: {
              labels: points.map(([k]) => k),
              datasets: [{
                data: points.map(([, v]) => v),
                borderColor: palette.series[0],
                backgroundColor: wash(palette.series[0], 0.1),
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.25,
                fill: true,
              }],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false }, tooltip: { enabled: false } },
              scales: { x: { display: false }, y: { display: false, beginAtZero: false } },
            },
          });
        } else {
          canvas.remove();
        }
      }
    }
  }

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

  function renderIntensityChart() {
    const canvas = document.getElementById('rpeChart');
    if (!canvas || !window.Intensity) return;
    const data = window.Intensity.buildScatterData(App.rawSessions);
    if (!data.length) {
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;

    // Num scatter qualquer par de pontos pode encostar, então o teto de cores
    // distinguíveis é 3 — não 8. Os demais exercícios viram uma nuvem de
    // contexto em cinza, que mostra a distribuição sem fingir identidade.
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
    lazyChart('tab-strength', 'oneRmChart', renderOneRmChart);
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
