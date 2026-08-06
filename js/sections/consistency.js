/**
 * js/sections/consistency.js — Heatmap diário e cards de PRs
 *
 * Namespace: window.Consistency
 *
 * O heatmap usa a rampa sequencial de uma cor só (window.Charts.palette.heat,
 * espelhada em --heat-1..4 no CSS): monotônica em L, com o degrau mais escuro
 * a 2.10:1 da superfície. Magnitude nunca vira arco-íris — a ordem precisa
 * estar visível na própria cor.
 *
 * Dependências: State, UI, Charts, Data, I18N
 */
window.Consistency = (function () {
  const { App } = window.State;
  const { spanText, prCard, prBadge, openSessionModal } = window.UI;
  const { getOrCreateChart, destroySparklines, palette, wash } = window.Charts;
  const { computePRs, classifyPRs } = window.Data;
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
        const dayLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR');
        // Dia com treino vira botão: o heatmap deixa de ser decorativo e abre
        // a sessão daquele dia, igual às linhas do histórico.
        const cell = document.createElement(vol ? 'button' : 'div');
        cell.className = 'heat-cell';
        if (vol) {
          const session = sessionByDay.get(dateStr);
          cell.type = 'button';
          cell.dataset.level = String(Math.max(1, Math.min(4, Math.ceil((vol / max) * 4))));
          cell.title = `${dayLabel}: ${nf(vol)} kg`;
          cell.setAttribute('aria-label', `${dayLabel}, ${nf(vol)} kg. Abrir treino.`);
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
          cell.title = `${dayLabel}: sem treino`;
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

  return { renderHeatmap, renderPRs };
})();
