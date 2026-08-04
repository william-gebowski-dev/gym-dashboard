/**
 * js/render.js — Renderização de KPIs, charts, streak, heatmap, PRs, tabela
 *
 * Namespace: window.Render
 *
 * Dependências: State, UI, Charts, Data
 */
window.Render = (function () {
  const { App, applyRange } = window.State;
  const { kpiCard, spanText, prCard, prBadge, sessionCard, openSessionModal } = window.UI;
  const { getOrCreateChart, destroySparklines } = window.Charts;
  const { computePRs, computePeriodDelta, computeWeeklyAdherence, classifyPRs } = window.Data;
  const { t } = window.I18N;

  function renderKPIs(sessions) {
    const sessionsDelta = computePeriodDelta(sessions, App.range, 'volume', 'count');
    const volumeDelta = computePeriodDelta(sessions, App.range, 'volume', 'sum');
    const adh = computeWeeklyAdherence(sessions, App.weeklyGoal);
    const prevAdh = computePeriodDelta(sessions, App.range, 'weeklyFreq', 'avg');
    const lastDate = sessions.at(-1)?.date;

    const allPRs = window.Data.computePRs(App.rawSessions);
    const classified = window.Data.classifyPRs(allPRs);
    const newPRs = classified.new.length;

    const buildDelta = (d) => {
      if (!d || d.previous <= 0) return null;
      return {
        pct: d.deltaPct,
        direction: d.deltaPct > 0 ? 'up' : d.deltaPct < 0 ? 'down' : 'flat',
      };
    };

    const container = document.getElementById('kpis');
    if (!container) return;
    container.replaceChildren(
      kpiCard(String(sessions.length), t('kpi.sessions'), buildDelta(sessionsDelta)),
      kpiCard(Math.round(volumeDelta.current).toLocaleString('pt-BR'), t('kpi.volume'), buildDelta(volumeDelta)),
      kpiCard(adh.weeklyFreq.toFixed(1), t('kpi.weeklyFreq'), buildDelta(prevAdh)),
      kpiCard(String(newPRs), t('kpi.newPRs'), null),
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
    const datasets = [{
      label: 'Volume (kg)',
      data: Object.values(monthlyData),
      backgroundColor: 'rgba(233, 69, 96, 0.6)',
      borderColor: '#e94560',
      borderWidth: 1,
      borderRadius: 6,
    }];

    if (App.range?.from) {
      const from = new Date(App.range.from);
      const spanMs = (sessions.length
        ? sessions.at(-1).date - from
        : Date.now() - from);
      const prevFrom = new Date(from.getTime() - spanMs);
      const prevTo = from;
      const prevMonthly = {};
      for (const s of App.sessions) {
        if (s.date < prevFrom || s.date >= prevTo) continue;
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
      datasets.push({
        label: 'Período anterior',
        data: prevData,
        type: 'line',
        borderColor: '#a1a1aa',
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 2,
        pointBackgroundColor: '#a1a1aa',
        tension: 0.25,
        spanGaps: false,
      });
    }

    const data = { labels, datasets };
    if (!App.charts.volumeChart) {
      getOrCreateChart('volumeChart', {
        type: 'bar',
        data,
        options: {
          responsive: true,
          plugins: { legend: { display: datasets.length > 1 } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
            x: { grid: { display: false } },
          },
        },
      });
    } else {
      const chart = App.charts.volumeChart;
      chart.data = data;
      chart.options.plugins.legend.display = datasets.length > 1;
      chart.update('none');
    }
  }

  function renderOneRmChart(sessions) {
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
    const data = {
      labels: top.map(([n]) => n),
      datasets: [{
        label: '1RM Estimado (kg)',
        data: top.map(([, v]) => Math.round(v)),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 6,
      }],
    };
    if (!App.charts.oneRmChart) {
      getOrCreateChart('oneRmChart', {
        type: 'bar',
        data,
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
            y: { grid: { display: false } },
          },
        },
      });
    } else {
      const chart = App.charts.oneRmChart;
      chart.data = data;
      chart.update('none');
    }
  }

  function renderWeekdayChart(sessions) {
    const counts = new Array(7).fill(0);
    for (const s of sessions) counts[s.date.getDay()]++;
    const data = {
      labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      datasets: [{
        label: 'Sessões',
        data: counts,
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 6,
      }],
    };
    if (!App.charts.weekdayChart) {
      getOrCreateChart('weekdayChart', {
        type: 'bar',
        data,
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' } },
            x: { grid: { display: false } },
          },
        },
      });
    } else {
      const chart = App.charts.weekdayChart;
      chart.data = data;
      chart.update('none');
    }
  }

  function renderSessionsTable(sessions) {
    const recent = sessions.slice(-10).reverse();
    const tbody = document.querySelector('#sessionsTable tbody');
    if (tbody) tbody.replaceChildren();
    const cards = document.getElementById('sessionsCards');
    if (cards) cards.replaceChildren();
    for (const s of recent) {
      if (tbody) {
        const tr = document.createElement('tr');
        tr.dataset.sessionId = s.id || '';
        for (const value of [
          s.date.toLocaleDateString('pt-BR'),
          s.name || 'Treino',
          String(s.exercises ?? 0),
          String(s.sets ?? 0),
          `${Math.round(s.volume).toLocaleString('pt-BR')} kg`,
        ]) {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        }
        tr.addEventListener('click', () => openSessionModal({
          id: s.id,
          date: s.date,
          name: s.name,
          exercisesCount: s.exercises,
          setsCount: s.sets,
          volume: s.volume,
        }));
        tbody.appendChild(tr);
      }
      if (cards) {
        cards.appendChild(sessionCard({
          id: s.id,
          date: s.date,
          name: s.name,
          exercisesCount: s.exercises,
          setsCount: s.sets,
          volume: s.volume,
        }));
      }
    }
  }

  function renderHeatmap(sessions) {
    const dailyVolume = {};
    for (const s of sessions) {
      const key = s.date.toISOString().slice(0, 10);
      dailyVolume[key] = (dailyVolume[key] || 0) + s.volume;
    }
    const max = Math.max(0, ...Object.values(dailyVolume));
    const sortedDates = Object.keys(dailyVolume).sort();
    if (sortedDates.length === 0) {
      document.getElementById('heatmap').replaceChildren();
      return;
    }
    const start = new Date(sortedDates[0]);
    const end = new Date(sortedDates.at(-1));
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const container = document.getElementById('heatmap');
    container.replaceChildren();
    const cursor = new Date(startMonth);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
      const firstDayWeek = new Date(year, month, 1).getDay();
      for (let i = 0; i < firstDayWeek; i++) {
        const blank = document.createElement('div');
        blank.className = 'heat-cell';
        grid.appendChild(blank);
      }
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'heat-cell';
        const vol = dailyVolume[dateStr];
        if (vol) {
          const level = Math.max(1, Math.min(4, Math.ceil((vol / max) * 4)));
          cell.dataset.level = String(level);
          cell.title = `${dateStr}: ${Math.round(vol).toLocaleString('pt-BR')} kg`;
        }
        grid.appendChild(cell);
      }
      monthWrap.appendChild(grid);
      container.appendChild(monthWrap);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  function renderPRs() {
    const prs = computePRs(App.rawSessions);
    const classified = classifyPRs(prs.map(p => ({
      name: p.name,
      weight: p.weight,
      date: p.date,
      history: p.history,
    })));
    const grid = document.getElementById('prGrid');
    destroySparklines();
    grid.replaceChildren();
    if (prs.length === 0) {
      grid.textContent = 'Nenhum PR registrado ainda.';
      return;
    }

    const renderGroup = (label, items, status) => {
      if (!items.length) return;
      const heading = document.createElement('div');
      heading.className = 'pr-group-heading';
      heading.textContent = label;
      grid.appendChild(heading);
      for (const pr of items) {
        const card = prCard(pr);
        const weight = card.querySelector('.pr-weight');
        if (weight) weight.textContent = `${Math.round(pr.weight)} kg`;

        const meta = document.createElement('div');
        meta.className = 'pr-meta';
        const dateStr = pr.date ? pr.date.toLocaleDateString('pt-BR') : '—';
        meta.append(
          spanText('PR: '),
          spanText(dateStr),
          spanText(' · '),
          spanText(`${pr.history.length} séries`),
        );
        card.appendChild(meta);
        card.appendChild(prBadge(status));

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
        const points = [...sessionsMax.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => ({ x: k, y: v }));

        if (points.length >= 2) {
          const canvasId = `pr-spark-${grid.children.length}`;
          canvas.id = canvasId;
          getOrCreateChart(canvasId, {
            type: 'line',
            data: {
              labels: points.map(p => p.x),
              datasets: [{
                data: points.map(p => p.y),
                borderColor: '#e94560',
                backgroundColor: 'rgba(233,69,96,0.15)',
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.25,
                fill: true,
              }],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { enabled: false } },
              scales: { x: { display: false }, y: { display: false, beginAtZero: false } },
            },
          });
        } else {
          canvas.remove();
        }
      }
    };

    renderGroup(t('pr.group.new'), classified.new, 'new');
    renderGroup(t('pr.group.evolving'), classified.evolving, 'evolving');
    renderGroup(t('pr.group.stagnant'), classified.stagnant, 'stagnant');
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

  function rerender() {
    const filtered = applyRange(App.sessions, App.range);
    renderKPIs(filtered);
    renderVolumeChart(filtered);
    renderOneRmChart(filtered);
    renderWeekdayChart(filtered);
    renderSessionsTable(filtered);
    renderAdherence(filtered);
    renderHeatmap(filtered);
    renderPRs();
  }

  return {
    renderKPIs, renderVolumeChart, renderOneRmChart, renderWeekdayChart,
    renderSessionsTable, renderAdherence, renderHeatmap, renderPRs,
    renderHero, rerender,
  };
})();
