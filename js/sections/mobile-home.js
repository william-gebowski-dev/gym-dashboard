/** Mobile-first home summary. Namespace: window.MobileHome */
window.MobileHome = (function () {
  const fmt = n => Math.round(n || 0).toLocaleString('pt-BR');
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  };

  function deltaText(delta) {
    if (!delta.hasBase) return delta.current ? 'Sem base anterior' : 'Sem dados';
    const arrow = delta.deltaPct > 0 ? '↑' : delta.deltaPct < 0 ? '↓' : '=';
    return `${arrow} ${Math.abs(delta.deltaPct)}% vs. 30 dias atrás`;
  }

  function tile(label, value, detail, direction = 'flat') {
    const el = make('div', 'mobile-home-tile');
    el.append(
      make('p', 'eyebrow', label),
      make('p', 'tile-value', value),
      make('p', 'tile-sub'),
    );
    el.lastChild.append(make('span', `delta ${direction}`, detail));
    return el;
  }

  function buildCard(snapshot) {
    const { latest, week, prevWeek, nextAction, monthDelta } = snapshot;
    const card = make('article', 'mobile-home-card');
    const head = make('div', 'mobile-home-head');
    head.append(make('p', 'eyebrow', latest ? 'ÚLTIMO TREINO' : 'SEM TREINOS REGISTRADOS'));
    head.append(make('h2', 'mobile-home-title', latest?.name || 'Adicione uma sessão para começar'));
    if (latest) {
      const date = latest.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
      head.append(make('p', 'mobile-home-meta', `${date} · ${latest.sets || 0} séries · ${fmt(latest.volume)} kg`));
    }
    card.append(head);

    const weekDelta = week.sessions - prevWeek.sessions;
    const weekPct = prevWeek.sessions ? Math.round((week.sessions / prevWeek.sessions - 1) * 100) : 100;
    const weekDirection = weekDelta > 0 ? 'up' : weekDelta < 0 ? 'down' : 'flat';
    const monthDirection = monthDelta.deltaPct > 0 ? 'up' : monthDelta.deltaPct < 0 ? 'down' : 'flat';
    const grid = make('div', 'mobile-home-grid');
    grid.append(
      tile('ESSA SEMANA', String(week.sessions), weekDelta ? `${weekDelta > 0 ? '↑' : '↓'} ${Math.abs(weekPct)}% vs semana passada` : '= 0 vs semana passada', weekDirection),
      tile('VOLUME 30 DIAS', `${fmt(monthDelta.current)} kg`, deltaText(monthDelta), monthDirection),
    );
    card.append(grid);

    const action = make('div', 'mobile-home-action');
    action.append(
      make('p', 'eyebrow', 'PRÓXIMO TREINO SUGERIDO'),
      make('p', 'mobile-home-next', nextAction || 'Sem dados suficientes'),
    );
    card.append(action);
    return card;
  }

  function buildTimelineItem(session) {
    const item = make('button', 'timeline-item');
    item.type = 'button';
    item.dataset.sessionId = session.id || '';
    item.append(
      make('span', 'timeline-date', session.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })),
      make('span', 'timeline-name', session.name || 'Treino'),
      make('span', 'timeline-stats', `${session.sets || 0} séries · ${fmt(session.volume)} kg`),
    );
    item.addEventListener('click', () => window.UI?.openSessionModal?.({
      id: session.id, date: session.date, name: session.name,
      exercisesCount: session.exercises, setsCount: session.sets, volume: session.volume,
    }));
    return item;
  }

  function render(sessions) {
    const home = document.getElementById('mobileHome');
    if (!home) return;
    const reference = sessions.at(-1)?.date || new Date();
    const snapshot = window.DashboardInsights.buildDashboardSnapshot(sessions, reference);
    home.replaceChildren(buildCard(snapshot));
    const timeline = document.getElementById('recentTimeline');
    if (timeline) timeline.replaceChildren(...snapshot.timeline.map(buildTimelineItem));
  }

  return { render };
})();
