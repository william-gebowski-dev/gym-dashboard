/**
 * js/sections/strength.js — Charts de volume, 1RM, weekday e tabela de sessões
 *
 * Namespace: window.Strength
 *
 * As cores vêm de window.Charts.palette, não de constantes locais: os oito
 * slots e a ORDEM deles foram validados contra a superfície real dos cards.
 * Um gráfico de série única usa sempre o slot 1 — pintar cada card de uma cor
 * diferente faria a cor significar "qual card" em vez de "qual série".
 *
 * Dependências: State, UI, Charts, Data, TableView
 */
window.Strength = (function () {
  const { App } = window.State;
  const { sessionCard, openSessionModal } = window.UI;
  const { getOrCreateChart, palette, axis } = window.Charts;
  const { pickOneRepMax } = window.Data;

  const nf = (n) => Math.round(n).toLocaleString('pt-BR');

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
      // Uma legenda que anuncia uma série que não desenha nada é ruído.
      if (prevData.filter(v => v !== null).length >= 2) {
        // Linha de referência, não uma segunda identidade: cinza de texto,
        // para não gastar um slot categórico no que é só "o antes".
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

  return { renderVolumeChart, renderOneRmChart, renderWeekdayChart, renderSessionsTable };
})();
