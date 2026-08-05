/**
 * js/sections/consistency.js — Heatmap e PRs da aba "consistency"
 *
 * Namespace: window.Consistency
 *
 * Funções extraídas de js/render.js (commit 5de7999) para isolar a
 * renderização do heatmap diário e dos cards de PRs com sparklines.
 *
 * Dependências: State, UI, Charts, Data, I18N
 */
window.Consistency = (function () {
  const { App } = window.State;
  const { spanText, prCard, prBadge } = window.UI;
  const { getOrCreateChart, destroySparklines } = window.Charts;
  const { computePRs, classifyPRs } = window.Data;
  const { t } = window.I18N;

  function renderHeatmap(sessions) {
    const dailyVolume = {};
    for (const s of sessions) {
      const key = s.date.toISOString().slice(0, 10);
      dailyVolume[key] = (dailyVolume[key] || 0) + s.volume;
    }
    const max = Math.max(0, ...Object.values(dailyVolume));
    const sortedDates = Object.keys(dailyVolume).sort();
    if (sortedDates.length === 0) {
      const el = document.getElementById('heatmap');
      if (el) el.replaceChildren();
      return;
    }
    const start = new Date(sortedDates[0]);
    const end = new Date(sortedDates.at(-1));
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const container = document.getElementById('heatmap');
    if (!container) return;
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
    if (!grid) return;
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
        // prCard (ui.js) já cria .pr-name e .pr-weight com peso formatado.
        const card = prCard(pr);

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
                borderColor: window.CHART_COLORS.accent,
                backgroundColor: 'rgba(255,64,93,0.15)',
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

  return { renderHeatmap, renderPRs };
})();
