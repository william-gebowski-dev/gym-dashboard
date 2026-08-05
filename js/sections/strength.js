/**
 * js/sections/strength.js — Charts e tabela da aba "strength"
 *
 * Namespace: window.Strength
 *
 * Funções extraídas de js/render.js (commit 5de7999) para isolar a
 * renderização dos charts de Volume, 1RM, Weekday e a tabela de sessões
 * recentes. chartRegistry fica em js/render.js (compartilhado com
 * renderHeatmap, renderPRs, etc.) — usamos getOrCreateChart direto.
 *
 * Dependências: State, UI, Charts, Data
 */
window.Strength = (function () {
  const { App } = window.State;
  const { sessionCard, openSessionModal } = window.UI;
  const { getOrCreateChart } = window.Charts;
  const { pickOneRepMax } = window.Data;

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
      backgroundColor: 'rgba(255, 64, 93, 0.6)',
      borderColor: window.CHART_COLORS.accent,
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

  function renderOneRmChart(_sessions) {
    const exerciseMax = {};
    for (const s of App.rawSessions) {
      for (const ex of s.workoutSessionExercises ?? []) {
        const name = ex.exercise?.name;
        if (!name) continue;
        let best = 0;
        for (const set of ex.workoutSessionSets ?? []) {
          if (!set.isComplete) continue;
          const oneRm = pickOneRepMax(set);
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
        backgroundColor: 'rgba(77, 141, 255, 0.6)',
        borderColor: window.CHART_COLORS.strength,
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
        backgroundColor: 'rgba(50, 213, 131, 0.6)',
        borderColor: window.CHART_COLORS.positive,
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

  return { renderVolumeChart, renderOneRmChart, renderWeekdayChart, renderSessionsTable };
})();
