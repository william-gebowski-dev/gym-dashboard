# Dashboard Evolução Inteligente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) superpowers:executing-plans implement plan task-by-task. Steps use checkbox (`- [ ]`) syntax tracking.

**Goal:** Transformar o gym-dashboard pessoal de relatório técnico empilhado em ferramenta inteligente com comparação vs período anterior, resumo automático, abas, PT-BR total e mobile corrigido.

**Architecture:** Preserva módulos atuais (`js/state.js`, `data.js`, `charts.js`, `ui.js`, `render.js`, `drop.js`, `main.js`). Adiciona `js/{i18n,summary,tabs}.js` e CSS em `index.html` para tabs/badges/deltas/mobile. Refatora `render.js` para usar comparação, classificação e aderência semanal.

**Tech Stack:** Vanilla JS + Chart.js 4.4.7 (CDN). Sem build, sem dependências novas.

## Global Constraints

- **Idiomas**: zero string em inglês na UI. Usar `I18N` em `js/i18n.js`.
- **Modular**: cada novo módulo exporta para `window.X` (padrão atual).
- **Sem build**: tudo via `<script defer>`. Não usar ES modules.
- **Mobile-first**: breakpoint 768px; cards < 768px, tabela ≥ 768px.
- **PT-BR**: datas em `pt-BR`, números `toLocaleString('pt-BR')`.
- **Sem placeholder**: cada step tem código concreto.
- **Commits frequentes**: ao fim de cada task.

---

## Task 1: Criar `js/i18n.js` com strings PT-BR

**Files:**
- Create: `js/i18n.js`

**Interfaces:**
- Produces: `window.I18N.t(key)` retorna string PT-BR

- [ ] **Step 1: Criar arquivo**

```js
// js/i18n.js — Strings PT-BR centralizadas
window.I18N = (function () {
  const dict = {
    'app.title': 'Evolução de William',
    'header.eyebrow': 'Painel',
    'header.lastUpdate': 'Atualizado',
    'tabs.overview': 'Visão Geral',
    'tabs.strength': 'Força',
    'tabs.consistency': 'Consistência',
    'tabs.history': 'Histórico',
    'kpi.sessions': 'Treinos',
    'kpi.volume': 'Volume (kg)',
    'kpi.weeklyFreq': 'Frequência Semanal',
    'kpi.newPRs': 'Novos Recordes',
    'chart.volume': 'Volume Mensal',
    'chart.oneRm': 'Top 10 por 1RM',
    'chart.weekday': 'Frequência Semanal',
    'adherence.title': 'Aderência Semanal',
    'adherence.current': 'Semanas atuais com ≥4 treinos',
    'adherence.goal': 'Meta',
    'pr.title': 'Recordes Pessoais',
    'pr.new': 'Novos',
    'pr.evolving': 'Em Evolução',
    'pr.stagnant': 'Estagnados',
    'sessions.title': 'Últimas Sessões',
    'sessions.exercises': 'Exercícios',
    'sessions.sets': 'Séries',
    'sessions.volume': 'Volume',
    'summary.improving': 'Volume subiu {pct}% e frequência subiu {freqDelta} treinos/semana.',
    'summary.mixed': 'Volume subiu {pct}%, mas frequência caiu de {prevFreq} para {curFreq} treinos semanais.',
    'summary.declining': 'Volume caiu {pct}% e frequência caiu {freqDelta} treinos/semana.',
    'delta.up': '↑ {pct}% vs período anterior',
    'delta.down': '↓ {pct}% vs período anterior',
    'delta.flat': '= estável vs período anterior',
    'loading': 'Carregando dados...',
    'empty.sessions': 'Nenhuma sessão no período.',
  };

  function t(key, vars = {}) {
    let s = dict[key] || key;
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, v);
    }
    return s;
  }

  return { t };
})();
```

- [ ] **Step 2: Carregar no `index.html`** Adicionar `<script defer src="js/i18n.js"></script>` antes de `js/state.js` (linha ~365).

- [ ] **Step 3: Verificar ordem de scripts** Confirmar que `i18n.js` carrega antes de qualquer módulo que use `I18N.t()`.

- [ ] **Step 4: Commit**

```bash
git add js/i18n.js index.html
git commit -m "feat(i18n): adicionar módulo de strings PT-BR"
```

---

## Task 2: Helper `computePeriodDelta` em `js/data.js`

**Files:**
- Modify: `js/data.js` (adicionar após função existente)

**Interfaces:**
- Produces: `window.Data.computePeriodDelta(sessions, range, field, agg)` → `{ current, previous, deltaPct }`

- [ ] **Step 1: Adicionar função** Após `computeStreak()` em `js/data.js`:

```js
function computePeriodDelta(sessions, range, field, agg = 'sum') {
  if (!sessions?.length) return { current: 0, previous: 0, deltaPct: 0 };

  const from = range?.from ? new Date(range.from) : null;
  const to = range?.to ? new Date(range.to) : new Date();
  const spanMs = to.getTime() - (from?.getTime() ?? sessions[0].date.getTime());

  const inRange = (d) => (!from || d >= from) && d <= to;
  const inPrev = (d) => {
    const prevTo = from ?? to;
    const prevFrom = new Date(prevTo.getTime() - spanMs);
    return d >= prevFrom && d < prevTo;
  };

  const aggregate = (xs) => {
    if (!xs.length) return 0;
    if (agg === 'avg') return xs.reduce((a, b) => a + b, 0) / xs.length;
    if (agg === 'count') return xs.length;
    return xs.reduce((a, b) => a + b, 0); // sum
  };

  const currentVals = sessions.filter(s => inRange(s.date)).map(s => s[field] ?? 0);
  const prevVals = sessions.filter(s => inPrev(s.date)).map(s => s[field] ?? 0);

  const current = aggregate(currentVals);
  const previous = aggregate(prevVals);
  const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

  return { current, previous, deltaPct };
}
```

- [ ] **Step 2: Exportar no namespace** Adicionar `computePeriodDelta` ao objeto retornado por `window.Data`.

- [ ] **Step 3: Verificar sintaxe** Abrir `data/WorkoutSession.json` num REPL Node e testar:
```bash
node -e "const {computePeriodDelta}=require('./js/data.js'); console.log(computePeriodDelta([],null,'volume'))"
```
Esperado: `{current:0,previous:0,deltaPct:0}` ou erro de import (módulo não usa `module.exports`). OK — apenas verificar que função não quebra sintaxe no browser via DevTools.

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat(data): helper computePeriodDelta para KPIs comparativos"
```

---

## Task 3: Helper `computeWeeklyAdherence` em `js/data.js`

**Files:**
- Modify: `js/data.js`

**Interfaces:**
- Produces: `window.Data.computeWeeklyAdherence(sessions, goal=4)` → `{ currentStreak, longestStreak, totalWeeks, weeksHit, weeklyFreq }`

- [ ] **Step 1: Adicionar função** Após `computePeriodDelta`:

```js
function computeWeeklyAdherence(sessions, goal = 4) {
  if (!sessions?.length) return { currentStreak: 0, longestStreak: 0, totalWeeks: 0, weeksHit: 0, weeklyFreq: 0 };

  // Agrupa sessões por semana ISO
  const weekCounts = new Map();
  for (const s of sessions) {
    const d = s.date;
    // ISO week: segunda-feira
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    const key = monday.toISOString().slice(0, 10);
    weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
  }

  const sortedWeeks = [...weekCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weeksHit = sortedWeeks.filter(([, n]) => n >= goal).length;

  // Streak atual: conta semanas consecutivas (terminando na mais recente) com >= goal
  let currentStreak = 0;
  for (let i = sortedWeeks.length - 1; i >= 0; i--) {
    if (sortedWeeks[i][1] >= goal) currentStreak++;
    else break;
  }

  // Streak mais longo
  let longestStreak = 0, run = 0;
  for (const [, n] of sortedWeeks) {
    if (n >= goal) { run++; longestStreak = Math.max(longestStreak, run); }
    else run = 0;
  }

  // Frequência semanal média
  const totalWeeks = sortedWeeks.length || 1;
  const weeklyFreq = sessions.length / totalWeeks;

  return { currentStreak, longestStreak, totalWeeks, weeksHit, weeklyFreq };
}
```

- [ ] **Step 2: Exportar no namespace**

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "feat(data): computeWeeklyAdherence substitui streak diário"
```

---

## Task 4: Helper `classifyPRs` em `js/data.js`

**Files:**
- Modify: `js/data.js`

**Interfaces:**
- Produces: `window.Data.classifyPRs(prs)` → `{ new: [], evolving: [], stagnant: [] }`

- [ ] **Step 1: Adicionar função**

```js
function classifyPRs(prs) {
  const now = new Date();
  const daysSince = (date) => Math.floor((now - new Date(date)) / (1000 * 60 * 60 * 24));

  const newPRs = [];
  const evolving = [];
  const stagnant = [];

  for (const pr of prs) {
    const days = pr.lastDate ? daysSince(pr.lastDate) : Infinity;
    if (days <= 30) newPRs.push({ ...pr, _daysSince: days });
    else if (days <= 60) evolving.push({ ...pr, _daysSince: days });
    else stagnant.push({ ...pr, _daysSince: days });
  }

  return { new: newPRs, evolving, stagnant };
}
```

- [ ] **Step 2: Exportar**

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "feat(data): classifyPRs categoriza recordes em novos/evolução/estagnados"
```

---

## Task 5: Atualizar `kpiCard` em `js/ui.js` para suportar delta

**Files:**
- Modify: `js/ui.js`

**Interfaces:**
- Produces: `window.UI.kpiCard(value, label, delta?)` aceita `{ pct, direction }`

- [ ] **Step 1: Localizar função atual** Ler `js/ui.js` e identificar `kpiCard()`.

- [ ] **Step 2: Substituir por versão com delta**

```js
function kpiCard(value, label, delta) {
  const card = document.createElement('div');
  card.className = 'kpi';
  
  const valEl = document.createElement('div');
  valEl.className = 'value';
  valEl.textContent = value;
  
  const labelEl = document.createElement('div');
  labelEl.className = 'label';
  labelEl.textContent = label;
  
  card.append(valEl, labelEl);
  
  if (delta && delta.pct !== undefined) {
    const deltaEl = document.createElement('div');
    deltaEl.className = `delta ${delta.direction || 'flat'}`;
    const arrow = delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '=';
    deltaEl.textContent = `${arrow} ${Math.abs(delta.pct)}% vs período anterior`;
    card.append(deltaEl);
  }
  
  return card;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): kpiCard com delta comparativo"
```

---

## Task 6: Adicionar `summaryCard` e `prBadge` em `js/ui.js`

**Files:**
- Modify: `js/ui.js`

**Interfaces:**
- Produces: `window.UI.summaryCard(text)`, `window.UI.prBadge(status)`

- [ ] **Step 1: Adicionar `summaryCard`**

```js
function summaryCard(text) {
  const el = document.createElement('div');
  el.className = 'summary-card';
  el.textContent = text;
  return el;
}
```

- [ ] **Step 2: Adicionar `prBadge`**

```js
function prBadge(status) {
  const el = document.createElement('span');
  el.className = `pr-badge ${status}`;
  const labels = { new: 'NOVO', evolving: 'EM EVOLUÇÃO', stagnant: 'ESTAGNADO' };
  el.textContent = labels[status] || status;
  return el;
}
```

- [ ] **Step 3: Exportar ambas no namespace**

- [ ] **Step 4: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): summaryCard e prBadge para novo layout"
```

---

## Task 7: Adicionar `sessionCard` em `js/ui.js` para mobile

**Files:**
- Modify: `js/ui.js`

**Interfaces:**
- Produces: `window.UI.sessionCard(session)`

- [ ] **Step 1: Adicionar função**

```js
function sessionCard(session) {
  const card = document.createElement('div');
  card.className = 'session-card';
  card.dataset.sessionId = session.id;

  const date = document.createElement('div');
  date.className = 'session-date';
  date.textContent = session.date.toLocaleDateString('pt-BR');

  const name = document.createElement('div');
  name.className = 'session-name';
  name.textContent = session.name || 'Treino';

  const stats = document.createElement('div');
  stats.className = 'session-stats';
  stats.innerHTML = `
    <span>${session.exercisesCount} exercícios</span>
    <span>${session.setsCount} séries</span>
    <span>${Math.round(session.volume).toLocaleString('pt-BR')} kg</span>
  `;

  card.append(date, name, stats);
  card.addEventListener('click', () => openSessionModal(session));
  return card;
}
```

- [ ] **Step 2: Stub `openSessionModal`** Por enquanto, função vazia:
```js
function openSessionModal(session) {
  // Placeholder — implementação completa em Task 16
  console.log('Open session modal:', session.id);
}
```

- [ ] **Step 3: Exportar** Adicionar `sessionCard` e `openSessionModal` ao namespace.

- [ ] **Step 4: Commit**

```bash
git add js/ui.js
git commit -m "feat(ui): sessionCard para visualização mobile"
```

---

## Task 8: Criar `js/summary.js`

**Files:**
- Create: `js/summary.js`

**Interfaces:**
- Produces: `window.Summary.render(sessions, range)` retorna string textual

- [ ] **Step 1: Criar arquivo**

```js
// js/summary.js — Geração de resumo textual automático
window.Summary = (function () {
  const { computePeriodDelta, computeWeeklyAdherence } = window.Data;
  const { t } = window.I18N;

  function render(sessions, range) {
    if (!sessions?.length) return t('empty.sessions');

    const vol = computePeriodDelta(sessions, range, 'volume');
    const adh = computeWeeklyAdherence(sessions);
    const prevAdh = computePeriodDelta(sessions, range, 'weeklyFreq', 'avg');
    
    const pct = vol.deltaPct;
    const curFreq = adh.weeklyFreq.toFixed(1);
    const prevFreq = prevAdh.previous.toFixed(1);
    const freqDelta = (adh.weeklyFreq - prevAdh.previous).toFixed(1);

    const isUp = pct > 0;
    const isDown = pct < 0;

    if (isUp && adh.weeklyFreq >= prevAdh.previous) {
      return t('summary.improving', { pct: Math.abs(pct), freqDelta });
    }
    if (isUp && adh.weeklyFreq < prevAdh.previous) {
      return t('summary.mixed', { pct: Math.abs(pct), prevFreq, curFreq });
    }
    if (isDown) {
      return t('summary.declining', { pct: Math.abs(pct), freqDelta });
    }
    return 'Desempenho estável em relação ao período anterior.';
  }

  return { render };
})();
```

- [ ] **Step 2: Carregar no `index.html`** Após `i18n.js`:
```html
<script defer src="js/i18n.js"></script>
<script defer src="js/summary.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add js/summary.js index.html
git commit -m "feat(summary): geração de resumo automático contextual"
```

---

## Task 9: Criar `js/tabs.js`

**Files:**
- Create: `js/tabs.js`

**Interfaces:**
- Produces: `window.Tabs.init()`, `window.Tabs.switch(name)`

- [ ] **Step 1: Criar arquivo**

```js
// js/tabs.js — Navegação por abas
window.Tabs = (function () {
  const { App } = window.State;
  const { t } = window.I18N;

  function init() {
    const nav = document.querySelector('.tabs-nav');
    if (!nav) return;

    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      switchTo(btn.dataset.tab);
    });

    switchTo(App.tab || 'overview');
  }

  function switchTo(name) {
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.hidden = panel.dataset.tab !== name;
    });
    document.querySelectorAll('.tabs-nav button[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    if (window.App) window.App.tab = name;
  }

  return { init, switch: switchTo };
})();
```

- [ ] **Step 2: Carregar no `index.html`** Antes de `main.js`:
```html
<script defer src="js/tabs.js"></script>
```

- [ ] **Step 3: Adicionar `App.tab` em `js/state.js`** No objeto `App`:
```js
App.tab = 'overview';
```

- [ ] **Step 4: Commit**

```bash
git add js/tabs.js index.html js/state.js
git commit -m "feat(tabs): navegação por abas para reduzir rolagem"
```

---

## Task 10: Reorganizar `index.html` com abas e hero compacto

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Substituir header** Localizar `<header class="hero fade-in">` (linha ~289) e substituir:

```html
<header class="hero fade-in compact">
  <div class="hero-top">
    <h1>Evolução de William</h1>
    <div class="hero-meta">
      <span id="lastWorkout"></span>
      <span class="dot">·</span>
      <span>Atualizado <span id="updatedAt">--:--</span></span>
    </div>
  </div>
  <div class="hero-period">
    <div class="period-chips" id="periodChips"></div>
    <div class="muscle-filter">
      <select id="muscleSelect">
        <option value="">Todos os grupos</option>
      </select>
    </div>
  </div>
  <div id="summarySlot" class="summary-slot"></div>
</header>
```

- [ ] **Step 2: Adicionar navegação por abas** Após `</header>`:

```html
<nav class="tabs-nav">
  <button data-tab="overview" class="active">Visão Geral</button>
  <button data-tab="strength">Força</button>
  <button data-tab="consistency">Consistência</button>
  <button data-tab="history">Histórico</button>
</nav>

<section class="tab-panel" data-tab="overview">
  <section class="kpis" id="kpis"></section>
  <div class="chart-row">
    <div class="chart-box"><h2>Volume Mensal</h2><canvas id="volumeChart"></canvas></div>
    <div class="chart-box"><h2>Frequência Semanal</h2><canvas id="weekdayChart"></canvas></div>
  </div>
</section>

<section class="tab-panel" data-tab="strength" hidden>
  <div class="chart-box"><h2>Top 10 por 1RM</h2><canvas id="oneRmChart"></canvas></div>
  <section class="chart-box"><h2>Recordes Pessoais</h2><div id="prGrid" class="pr-grid"></div></section>
</section>

<section class="tab-panel" data-tab="consistency" hidden>
  <section class="chart-box">
    <h2>Aderência Semanal</h2>
    <div id="adherenceCards" class="kpis"></div>
    <div id="heatmap" class="heatmap"></div>
  </section>
</section>

<section class="tab-panel" data-tab="history" hidden>
  <section class="chart-box">
    <h2>Últimas Sessões</h2>
    <table id="sessionsTable">
      <thead>
        <tr><th>Data</th><th>Nome</th><th>Exercícios</th><th>Séries</th><th>Volume</th></tr>
      </thead>
      <tbody></tbody>
    </table>
    <div id="sessionsCards" class="sessions-cards"></div>
  </section>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(layout): hero compacto + navegação por abas"
```

---

## Task 11: CSS para abas, badges, deltas, mobile

**Files:**
- Modify: `index.html` (bloco `<style>`)

- [ ] **Step 1: Adicionar CSS após regras existentes**

```css
/* Hero compacto */
.hero.compact { padding: 24px 32px; margin-bottom: 24px; }
.hero-top { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.hero-top h1 { font-size: clamp(1.5rem, 2.5vw, 2.25rem); margin: 0; }
.hero-meta { color: var(--muted); font-size: 0.85rem; }
.hero-meta .dot { margin: 0 8px; }
.hero-period { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.period-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.period-chips button {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text);
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  cursor: pointer;
}
.period-chips button.active { background: var(--accent); border-color: var(--accent); }

/* Summary slot */
.summary-slot { margin-top: 16px; }
.summary-card {
  background: rgba(233,69,96,0.08);
  border-left: 3px solid var(--accent);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.95rem;
  color: var(--text);
}

/* Tabs */
.tabs-nav { display: flex; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; overflow-x: auto; }
.tabs-nav button {
  background: transparent;
  border: none;
  color: var(--muted);
  padding: 12px 20px;
  cursor: pointer;
  font-size: 0.95rem;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.tabs-nav button.active { color: var(--text); border-bottom-color: var(--accent); }

/* Chart row 2 colunas */
.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.chart-row .chart-box { margin-bottom: 0; }
@media (max-width: 900px) { .chart-row { grid-template-columns: 1fr; } }

/* KPI delta */
.kpi .delta { font-size: 0.75rem; margin-top: 6px; color: var(--muted); }
.kpi .delta.up { color: var(--ok); }
.kpi .delta.down { color: var(--warn); }
.kpi .delta.flat { color: var(--muted); }

/* PR badges classificados */
.pr-card { position: relative; }
.pr-badge.new { background: var(--ok); color: #000; }
.pr-badge.evolving { background: var(--accent-2); color: #000; }
.pr-badge.stagnant { background: var(--warn); color: #000; }

/* Mobile cards */
@media (max-width: 768px) {
  #sessionsTable { display: none; }
  .sessions-cards { display: flex; flex-direction: column; gap: 12px; }
  .session-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 14px;
    cursor: pointer;
  }
  .session-card .session-date { font-size: 0.8rem; color: var(--muted); }
  .session-card .session-name { font-weight: 600; margin: 4px 0; }
  .session-card .session-stats { display: flex; gap: 12px; font-size: 0.85rem; color: var(--muted); }
}
@media (min-width: 769px) { .sessions-cards { display: none; } }
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "style: CSS para abas, deltas, badges, mobile cards"
```

---

## Task 12: Refatorar `renderKPIs` em `js/render.js` para usar deltas

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Consumes: `Data.computePeriodDelta`
- Replaces: `renderKPIs(sessions)`

- [ ] **Step 1: Substituir `renderKPIs`** Localizar e substituir a função existente:

```js
function renderKPIs(sessions) {
  const { computePeriodDelta } = window.Data;
  
  const sessionsDelta = computePeriodDelta(sessions, App.range, 'volume', 'count');
  const volumeDelta = computePeriodDelta(sessions, App.range, 'volume', 'sum');
  const adh = computeWeeklyAdherence(sessions);
  const prevAdh = computePeriodDelta(sessions, App.range, 'weeklyFreq', 'avg');
  const newPRs = (sessions || []).filter(s => {
    const d = new Date(s.date);
    const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).length;
  
  const buildDelta = (d) => d.previous > 0 ? { pct: d.deltaPct, direction: d.deltaPct > 0 ? 'up' : d.deltaPct < 0 ? 'down' : 'flat' } : null;
  
  const container = document.getElementById('kpis');
  container.replaceChildren(
    kpiCard(sessions.length.toString(), 'Treinos', buildDelta(sessionsDelta)),
    kpiCard(Math.round(volumeDelta.current).toLocaleString('pt-BR'), 'Volume (kg)', buildDelta(volumeDelta)),
    kpiCard(adh.weeklyFreq.toFixed(1), 'Frequência Semanal', buildDelta(prevAdh)),
    kpiCard(newPRs.toString(), 'Novos Recordes', null),
  );
}
```

- [ ] **Step 2: Adicionar import** No topo de `render.js`, adicionar `computeWeeklyAdherence` ao destructure:
```js
const { computePRs, computeStreak, computePeriodDelta, computeWeeklyAdherence, classifyPRs } = window.Data;
```

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "feat(render): KPIs com deltas comparativos"
```

---

## Task 13: Adicionar `renderAdherence` em `js/render.js`

**Files:**
- Modify: `js/render.js`

**Interfaces:**
- Produces: função que renderiza cards de aderência semanal

- [ ] **Step 1: Adicionar função** Após `renderKPIs`:

```js
function renderAdherence(sessions) {
  const adh = computeWeeklyAdherence(sessions);
  const goal = App.weeklyGoal || 4;
  
  const container = document.getElementById('adherenceCards');
  if (!container) return;
  
  container.replaceChildren(
    kpiCard(`${adh.currentStreak}`, 'Semanas atuais com ≥' + goal + ' treinos'),
    kpiCard(`${adh.longestStreak}`, 'Recorde de semanas'),
    kpiCard(`${adh.weeksHit}/${adh.totalWeeks}`, 'Semanas cumpridas'),
    kpiCard(adh.weeklyFreq.toFixed(1), 'Frequência semanal média'),
  );
}
```

- [ ] **Step 2: Adicionar `App.weeklyGoal` em `js/state.js`**
```js
App.weeklyGoal = 4;
```

- [ ] **Step 3: Commit**

```bash
git add js/render.js js/state.js
git commit -m "feat(render): aderência semanal substitui streak diário"
```

---

## Task 14: Refatorar `renderPRs` com classificação

**Files:**
- Modify: `js/render.js`

- [ ] **Step 1: Substituir `renderPRs`** Localizar função existente e substituir:

```js
function renderPRs(sessions) {
  const prs = computePRs(sessions);
  const classified = classifyPRs(prs);
  const { prCard, prBadge } = window.UI;
  
  const container = document.getElementById('prGrid');
  if (!container) return;
  
  const renderGroup = (label, items, status) => {
    if (!items.length) return document.createDocumentFragment();
    const frag = document.createDocumentFragment();
    const heading = document.createElement('h3');
    heading.className = 'pr-group-heading';
    heading.textContent = label;
    frag.append(heading);
    for (const pr of items) {
      const card = prCard(pr);
      card.append(prBadge(status));
      frag.append(card);
    }
    return frag;
  };
  
  container.replaceChildren(
    renderGroup('Novos Recordes (≤ 30 dias)', classified.new, 'new'),
    renderGroup('Em Evolução (≤ 60 dias)', classified.evolving, 'evolving'),
    renderGroup('Estagnados (> 60 dias)', classified.stagnant, 'stagnant'),
  );
}
```

- [ ] **Step 2: Verificar `prCard` em `ui.js`** Se não existir, adicionar:
```js
function prCard(pr) {
  const card = document.createElement('div');
  card.className = 'pr-card';
  
  const name = document.createElement('div');
  name.className = 'pr-name';
  name.textContent = pr.name;
  
  const weight = document.createElement('div');
  weight.className = 'pr-weight';
  weight.textContent = pr.weight.toFixed(1) + ' kg';
  
  card.append(name, weight);
  return card;
}
```

- [ ] **Step 3: Commit**

```bash
git add js/render.js js/ui.js
git commit -m "feat(render): PRs classificados em novos/evolução/estagnados"
```

---

## Task 15: Refatorar `renderSessions` com mobile cards

**Files:**
- Modify: `js/render.js`

- [ ] **Step 1: Substituir `renderSessions`** Localizar e substituir:

```js
function renderSessions(sessions) {
  const last10 = sessions.slice(-10).reverse();
  
  // Desktop table
  const tbody = document.querySelector('#sessionsTable tbody');
  if (tbody) {
    tbody.replaceChildren(...last10.map(s => {
      const row = document.createElement('tr');
      row.dataset.sessionId = s.id;
      row.innerHTML = `
        <td>${s.date.toLocaleDateString('pt-BR')}</td>
        <td>${escapeHtml(s.name || 'Treino')}</td>
        <td>${s.exercisesCount}</td>
        <td>${s.setsCount}</td>
        <td>${Math.round(s.volume).toLocaleString('pt-BR')} kg</td>
      `;
      row.addEventListener('click', () => openSessionModal(s));
      return row;
    }));
  }
  
  // Mobile cards
  const cardsContainer = document.getElementById('sessionsCards');
  if (cardsContainer) {
    const { sessionCard } = window.UI;
    cardsContainer.replaceChildren(...last10.map(s => sessionCard(s)));
  }
}
```

- [ ] **Step 2: Garantir `escapeHtml` disponível** Se não estiver em `ui.js`, importar ou duplicar:
```js
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
```

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "feat(render): sessões com cards mobile + click handler"
```

---

## Task 16: Modal de drill-down de sessão

**Files:**
- Modify: `js/ui.js`

- [ ] **Step 1: Implementar `openSessionModal`** Substituir stub da Task 7:

```js
function openSessionModal(session) {
  const existing = document.getElementById('sessionModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'sessionModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" aria-label="Fechar">×</button>
      <h2>${escapeHtml(session.name || 'Treino')}</h2>
      <p class="modal-date">${session.date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="modal-stats">
        <span><strong>${session.exercisesCount}</strong> exercícios</span>
        <span><strong>${session.setsCount}</strong> séries</span>
        <span><strong>${Math.round(session.volume).toLocaleString('pt-BR')} kg</strong> volume</span>
      </div>
      <p class="modal-hint">Drill-down completo em próxima iteração.</p>
    </div>
  `;
  
  document.body.append(modal);
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
```

- [ ] **Step 2: CSS modal em `index.html`** Adicionar:

```css
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal-content {
  background: var(--card);
  border-radius: var(--radius);
  padding: 32px;
  max-width: 600px;
  width: 100%;
  position: relative;
}
.modal-close {
  position: absolute; top: 12px; right: 16px;
  background: transparent; border: none;
  color: var(--text); font-size: 1.5rem;
  cursor: pointer;
}
.modal-date { color: var(--muted); margin: 8px 0 16px; }
.modal-stats { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 16px; }
.modal-hint { color: var(--muted); font-size: 0.85rem; }
```

- [ ] **Step 3: Commit**

```bash
git add js/ui.js index.html
git commit -m "feat(ui): modal de drill-down para sessão"
```

---

## Task 17: Carregar `main.js` chama `Summary.render`, `initTabs`, popula timestamps

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Adicionar chamadas após fetch bem-sucedido** Localizar ponto onde `App.loadedAt` (ou equivalente) é setado e adicionar:

```js
// Após sucesso do fetch
App.loadedAt = new Date();
const updatedEl = document.getElementById('updatedAt');
if (updatedEl) updatedEl.textContent = App.loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const lastSession = sessions.at(-1);
const lastEl = document.getElementById('lastWorkout');
if (lastEl && lastSession) lastEl.textContent = 'Último treino: ' + lastSession.date.toLocaleDateString('pt-BR');

// Resumo automático
const summarySlot = document.getElementById('summarySlot');
if (summarySlot) {
  const text = Summary.render(sessions, App.range);
  const card = summaryCard(text);
  summarySlot.replaceChildren(card);
}

// Tabs
Tabs.init();
```

- [ ] **Step 2: Chamar `renderAdherence` no fluxo** No local onde `renderKPIs` é chamado, adicionar `renderAdherence(sessions)` em seguida.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat(main): timestamps, summary, tabs init no carregamento"
```

---

## Task 18: Tradução completa de strings em `index.html` e `render.js`

**Files:**
- Modify: `index.html`, `js/render.js`

- [ ] **Step 1: `index.html`** Trocar todas as strings em inglês:

| Antes | Depois |
|---|---|
| `Dashboard Academia` (eyebrow) | removido |
| `Sua Evolução` | `Evolução de William` |
| `Top 10 Exercícios por 1RM` | `Top 10 por 1RM` |
| `🔥 Streak & Consistência` | `Aderência Semanal` |
| `📅 Volume Diário (Heatmap Mensal)` | `Volume Diário` |
| `🏆 Personal Records (com evolução)` | `Recordes Pessoais` |
| `Últimas Sessões` | mantido |

- [ ] **Step 2: `js/render.js`** Trocar labels de Chart.js e tooltips. Onde aparecer:
- "Volume (kg)" → via `I18N.t('kpi.volume')`
- "Período anterior" → "Período anterior" (já PT-BR)
- "Top 10" → ok
- Outros títulos em `h2` → usar `I18N.t()`

- [ ] **Step 3: Commit**

```bash
git add index.html js/render.js
git commit -m "i18n: tradução completa PT-BR de strings visíveis"
```

---

## Task 19: Verificação end-to-end e commit final

**Files:**
- Verify all

- [ ] **Step 1: Servir e abrir**

```bash
cd /home/william/gym-dashboard
python3 -m http.server 8000 &
sleep 2
curl -s http://localhost:8000/ | head -5
```

Esperado: HTML começa com `<!DOCTYPE html>`.

- [ ] **Step 2: Inspecionar console do browser** Abrir `http://localhost:8000`, abrir DevTools → Console. Verificar zero erros.

- [ ] **Step 3: Validar KPIs com delta** Confirmar visualmente que 4 KPIs mostram `↑/↓ %` colorido.

- [ ] **Step 4: Validar abas** Clicar em cada aba — conteúdo muda, URL não recarrega.

- [ ] **Step 5: Validar mobile** DevTools → toggle device (375px). Tabela some, cards aparecem.

- [ ] **Step 6: Validar PT-BR** Buscar no DevTools "Personal Records" ou "Streak" — não deve aparecer.

- [ ] **Step 7: Validar modal** Clicar numa sessão — modal abre.

- [ ] **Step 8: Stop server + commit final**

```bash
kill %1 2>/dev/null
git add -A
git status
git commit -m "feat: dashboard inteligente — comparação, resumo, abas, PT-BR, mobile"
```

- [ ] **Step 9: Push para GitHub**

```bash
git remote -v
git push origin main
```

Se remote não existir ou branch diferir, configurar antes:
```bash
git remote add origin https://github.com/william-gebowski-dev/gym-dashboard.git
git branch -M main
git push -u origin main
```

---

## Critical files modified

- `index.html` — hero compacto, abas, CSS, PT-BR
- `js/i18n.js` (novo) — strings PT-BR
- `js/summary.js` (novo) — resumo automático
- `js/tabs.js` (novo) — navegação por abas
- `js/state.js` — `App.tab`, `App.weeklyGoal`
- `js/data.js` — `computePeriodDelta`, `computeWeeklyAdherence`, `classifyPRs`
- `js/ui.js` — `kpiCard` com delta, `summaryCard`, `prBadge`, `prCard`, `sessionCard`, `openSessionModal`
- `js/render.js` — KPIs comparativos, `renderAdherence`, PRs classificados, sessões mobile
- `js/main.js` — init tabs, summary, timestamps

## Verification (end-to-end)

1. `cd /home/william/gym-dashboard && python3 -m http.server 8000`
2. Abrir `http://localhost:8000`
3. Confirmar: hero compacto, 4 KPIs com `↑/↓ %`, resumo textual, 4 abas funcionais, heatmap em "Consistência", tabela + cards em "Histórico"
4. Trocar período — KPIs recalculam
5. Resize para 375px — tabela some, cards aparecem
6. Console — zero erros, zero strings em inglês visíveis
7. Click numa sessão — modal abre
8. `git push origin main` — código publicado no GitHub