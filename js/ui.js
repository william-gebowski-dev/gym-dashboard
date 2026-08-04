/**
 * js/ui.js — Primitives DOM-safe
 *
 * Namespace: window.UI
 */
window.UI = (function () {
  function kpiCard(value, label, delta) {
    const card = document.createElement('div');
    card.className = 'kpi';
    const v = document.createElement('div');
    v.className = 'value';
    v.textContent = String(value);
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = label;
    card.append(v, l);
    if (delta && typeof delta.pct === 'number') {
      const d = document.createElement('div');
      const direction = delta.direction || (delta.pct > 0 ? 'up' : delta.pct < 0 ? 'down' : 'flat');
      d.className = `delta ${direction}`;
      const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '=';
      d.textContent = `${arrow} ${Math.abs(delta.pct)}% vs período anterior`;
      card.append(d);
    }
    return card;
  }

  function summaryCard(text) {
    const el = document.createElement('div');
    el.className = 'summary-card';
    el.textContent = text;
    return el;
  }

  function prBadge(status) {
    const labels = { new: 'NOVO', evolving: 'EM EVOLUÇÃO', stagnant: 'ESTAGNADO' };
    const el = document.createElement('span');
    el.className = `pr-badge ${status}`;
    el.textContent = labels[status] || status;
    return el;
  }

  function prCard(pr) {
    const card = document.createElement('div');
    card.className = 'pr-card';
    const name = document.createElement('div');
    name.className = 'pr-name';
    name.textContent = pr.name;
    name.title = pr.name;
    card.append(name);
    const weight = document.createElement('div');
    weight.className = 'pr-weight';
    weight.textContent = `${Math.round(pr.weight)} kg`;
    card.append(weight);
    return card;
  }

  function sessionCard(session) {
    const card = document.createElement('div');
    card.className = 'session-card';
    card.dataset.sessionId = session.id || '';

    const date = document.createElement('div');
    date.className = 'session-date';
    date.textContent = session.date.toLocaleDateString('pt-BR');

    const name = document.createElement('div');
    name.className = 'session-name';
    name.textContent = session.name || 'Treino';

    const stats = document.createElement('div');
    stats.className = 'session-stats';
    const ex = session.exercisesCount ?? session.exercises ?? 0;
    const sets = session.setsCount ?? session.sets ?? 0;
    const vol = Math.round(session.volume).toLocaleString('pt-BR');
    stats.append(
      spanText(`${ex} exercícios`),
      spanText(' · '),
      spanText(`${sets} séries`),
      spanText(' · '),
      spanText(`${vol} kg`),
    );

    card.append(date, name, stats);
    card.addEventListener('click', () => openSessionModal(session));
    return card;
  }

  function openSessionModal(session) {
    const existing = document.getElementById('sessionModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sessionModal';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sessionModalTitle');

    const content = document.createElement('div');
    content.className = 'modal-content';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Fechar');
    closeBtn.textContent = '×';

    const title = document.createElement('h2');
    title.id = 'sessionModalTitle';
    title.textContent = session.name || 'Treino';

    const dateStr = session.date.toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const date = document.createElement('p');
    date.className = 'modal-date';
    date.textContent = dateStr;

    const stats = document.createElement('div');
    stats.className = 'modal-stats';
    const ex = session.exercisesCount ?? session.exercises ?? 0;
    const sets = session.setsCount ?? session.sets ?? 0;
    const vol = Math.round(session.volume).toLocaleString('pt-BR');
    stats.append(
      spanStrong(`${ex} exercícios`),
      spanStrong(`${sets} séries`),
      spanStrong(`${vol} kg volume`),
    );

    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = 'Drill-down completo em próxima iteração.';

    content.append(closeBtn, title, date, stats, hint);
    overlay.append(content);
    document.body.append(overlay);

    const prevFocus = document.activeElement;
    closeBtn.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') overlay.remove();
    };
    document.addEventListener('keydown', onKey);

    const cleanup = () => {
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };

    const close = () => { overlay.remove(); cleanup(); };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.removedNodes) {
          if (n === overlay) { cleanup(); observer.disconnect(); return; }
        }
      }
    });
    observer.observe(document.body, { childList: true });
  }

  function spanText(text) {
    const s = document.createElement('span');
    s.textContent = text;
    return s;
  }

  function spanStrong(text) {
    const s = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = text;
    s.append(strong);
    return s;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    kpiCard, summaryCard, prBadge, prCard, sessionCard, openSessionModal,
    spanText, spanStrong, escapeHtml,
  };
})();