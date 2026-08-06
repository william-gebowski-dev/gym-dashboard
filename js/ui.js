/**
 * js/ui.js — Primitives DOM-safe
 *
 * Namespace: window.UI
 */
window.UI = (function () {
  function kpiCard(value, label, delta, sub) {
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
    if (sub && typeof sub.text === 'string') {
      const s = document.createElement('div');
      s.className = `sub ${sub.tone || 'muted'}`;
      s.textContent = sub.text;
      card.append(s);
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
    // <button> em vez de <div>: o card abre um modal, então precisa ser
    // focável e acionável por teclado sem handlers extras.
    const card = document.createElement('button');
    card.type = 'button';
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

  function renderSessionExercises(sessionId) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-exercises';

    const raw = (window.State && window.State.App && window.State.App.rawSessions) || [];
    const rawSession = raw.find(s => s.id === sessionId);

    if (!rawSession) {
      const p = document.createElement('p');
      p.className = 'modal-hint';
      p.textContent = 'Dados detalhados indisponíveis para esta sessão.';
      wrap.append(p);
      return wrap;
    }

    const exercises = rawSession.workoutSessionExercises ?? [];
    if (exercises.length === 0) {
      const p = document.createElement('p');
      p.className = 'modal-hint';
      p.textContent = 'Sessão sem exercícios registrados.';
      wrap.append(p);
      return wrap;
    }

    for (const ex of exercises) {
      const sets = (ex.workoutSessionSets ?? []).filter(s => s.isComplete && typeof s.weight === 'number');
      if (sets.length === 0) continue;

      const block = document.createElement('div');
      block.className = 'modal-exercise';

      const heading = document.createElement('h3');
      heading.className = 'modal-exercise-name';
      heading.textContent = ex.exercise?.name || 'Exercício';

      const muscle = document.createElement('p');
      muscle.className = 'modal-exercise-meta';
      const primary = (ex.exercise?.primaryMuscleGroups ?? []).map(m => m.name).join(', ');
      const eq = ex.exercise?.equipment || '';
      muscle.textContent = [primary, eq].filter(Boolean).join(' · ');

      const table = document.createElement('table');
      table.className = 'modal-sets-table';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>#</th><th>Reps</th><th>Peso</th><th>1RM</th><th>Descanso</th></tr>';
      table.append(thead);

      const tbody = document.createElement('tbody');
      sets.forEach((s, idx) => {
        const tr = document.createElement('tr');
        const cells = [
          String(idx + 1),
          String(s.reps ?? '-'),
          `${Number(s.weight).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`,
          s.oneRepMax ? `${Number(s.oneRepMax).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg` : '-',
          s.restTime ? `${Math.round(s.restTime / 60)} min` : '-',
        ];
        cells.forEach(c => {
          const td = document.createElement('td');
          td.textContent = c;
          tr.append(td);
        });
        tbody.append(tr);
      });
      table.append(tbody);

      block.append(heading, muscle, table);
      wrap.append(block);
    }

    if (!wrap.children.length) {
      const p = document.createElement('p');
      p.className = 'modal-hint';
      p.textContent = 'Sessão sem séries completas registradas.';
      wrap.append(p);
    }
    return wrap;
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

    content.append(closeBtn, title, date, stats);
    content.append(renderSessionExercises(session.id));
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

  /**
   * Escape defensivo para quando um valor precisar entrar como HTML.
   *
   * O resto deste módulo constrói DOM com textContent, que já é imune a
   * injeção — esta função existe como rede de segurança para o dia em que
   * alguém precisar montar markup por string. Coberta por tests/ui.test.js.
   */
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