/**
 * js/streak.js — Tira de 12 semanas e linha de estado da hero
 *
 * Namespace: window.Streak
 *
 * A pergunta que a primeira dobra precisa responder é "estou treinando?", e
 * nenhum número responde isso tão rápido quanto a própria grade de dias — o
 * artefato do caderno de treino. A tira mostra as últimas 12 semanas SEMPRE em
 * escala absoluta (dia treinado / dia vazio), independente do filtro de
 * período: o filtro muda a análise, não muda se você apareceu na segunda.
 *
 * Dependências: State
 */
window.Streak = (function () {
  const WEEKS = 12;
  const DAY_MS = 86_400_000;

  /** Segunda-feira da semana de `date`, em horário local, à meia-noite. */
  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * @param {Array} sessions sessões normalizadas (todas, não filtradas)
   * @returns {{days: Array, trained: number, lastDate: Date|null, gapDays: number|null}}
   */
  function build(sessions) {
    const byDay = new Map();
    for (const s of sessions ?? []) byDay.set(dayKey(s.date), s);

    const today = new Date();
    const start = mondayOf(today);
    start.setDate(start.getDate() - (WEEKS - 1) * 7);

    const days = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      if (d > today) break;
      const session = byDay.get(dayKey(d));
      days.push({ date: d, session: session ?? null });
    }

    const sorted = (sessions ?? []).map(s => s.date).sort((a, b) => a - b);
    const lastDate = sorted.at(-1) ?? null;
    // Diferença em dias de calendário: compara meia-noite com meia-noite, para
    // que um treino às 22h de ontem conte como 1 dia, não como 0.
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const gapDays = lastDate
      ? Math.round((todayMid - new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())) / DAY_MS)
      : null;

    return {
      days,
      trained: days.filter(d => d.session).length,
      lastDate,
      gapDays,
    };
  }

  /** Frase de estado: fato primeiro, sem adjetivo e sem repreensão. */
  function statusLine({ trained, lastDate, gapDays }) {
    if (!lastDate) return 'Nenhum treino registrado ainda.';
    if (gapDays === 0) return 'Você treinou hoje.';
    if (gapDays === 1) return 'Último treino ontem.';
    if (gapDays <= 7) return `Último treino há ${gapDays} dias · ${trained} nas últimas 12 semanas.`;
    if (gapDays < 60) return `Sem treino há ${gapDays} dias · ${trained} nas últimas 12 semanas.`;
    const months = Math.round(gapDays / 30);
    return `Sem treino há ${months} meses · o último foi em ${lastDate.toLocaleDateString('pt-BR')}.`;
  }

  function render(sessions) {
    const strip = document.getElementById('streakStrip');
    const grid = document.getElementById('streakGrid');
    const caption = document.getElementById('streakCaption');
    const status = document.getElementById('heroStatus');
    if (!strip || !grid) return;

    const data = build(sessions);
    if (status) status.textContent = statusLine(data);
    if (!data.days.length) { strip.hidden = true; return; }
    strip.hidden = false;

    const frag = document.createDocumentFragment();
    for (const { date, session } of data.days) {
      const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const cell = document.createElement(session ? 'button' : 'div');
      cell.className = 'streak-day';
      if (session) {
        cell.type = 'button';
        cell.dataset.on = '';
        cell.title = `${label} · ${session.name || 'Treino'}`;
        cell.setAttribute('aria-label', `${label}, ${session.name || 'treino'}. Abrir.`);
        cell.addEventListener('click', () => window.UI.openSessionModal({
          id: session.id,
          date: session.date,
          name: session.name,
          exercisesCount: session.exercises,
          setsCount: session.sets,
          volume: session.volume,
        }));
      } else {
        cell.title = `${label} · sem treino`;
      }
      frag.append(cell);
    }
    grid.replaceChildren(frag);
    grid.setAttribute('aria-label', `Últimas 12 semanas: ${data.trained} dias treinados`);
    if (caption) caption.textContent = `Últimas 12 semanas · ${data.trained} ${data.trained === 1 ? 'dia treinado' : 'dias treinados'}`;

    // Rótulo de mês sobre a primeira coluna de cada mês novo: sem ele a grade
    // é uma textura sem eixo, e o leitor não sabe onde está no calendário.
    const months = document.getElementById('streakMonths');
    if (months) {
      const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const frag2 = document.createDocumentFragment();
      let last = null;
      for (let col = 0; col * 7 < data.days.length; col++) {
        const first = data.days[col * 7].date;
        const span = document.createElement('span');
        if (first.getMonth() !== last) {
          span.textContent = names[first.getMonth()];
          last = first.getMonth();
        }
        frag2.append(span);
      }
      months.replaceChildren(frag2);
    }
  }

  return { build, statusLine, render };
})();
