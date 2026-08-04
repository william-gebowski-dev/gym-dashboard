# Pass 2 — Correções e Higiene — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 3 blockers + 5 Important findings do code review, remover dead exports, melhorar UX sem quebrar nada.

**Architecture:** Preserva módulos existentes. Mudanças pontuais em `data.js`, `state.js`, `tabs.js`, `ui.js`, `render.js`, `main.js`. Nenhum arquivo novo.

**Tech Stack:** Vanilla JS + Chart.js. Sem deps novas.

## Global Constraints

- **Sem regressão**: cada mudança passa por smoke test no browser.
- **Tabela PeriodDelta**: `all` comparar contra período anterior de mesmo tamanho (não contra história inteira).
- **Dead code**: deletar `computeStreak`, `Tabs.t`, `Tabs.switch` (este último só se não usado).
- **Sem `innerHTML`**: continua DOM-safe.
- **Commits pequenos**: 1-2 por task.

---

## Task 1: Fix `computePeriodDelta` para range `all`

**Files:**
- Modify: `js/data.js:78-119`

**Interfaces:**
- `computePeriodDelta(sessions, range, field, agg)` agora usa `sessions` para definir `absSpan` quando range.from ausente.

- [ ] **Step 1: Substituir a função**

Localizar a função inteira `computePeriodDelta` e substituir:

```js
function computePeriodDelta(sessions, range, field, agg) {
    if (!sessions || sessions.length === 0) return { current: 0, previous: 0, deltaPct: 0 };
    agg = agg || 'sum';

    // Define absSpan sempre baseado nos dados quando não há range.from.
    // Caso contrário, usa o tamanho do range selecionado.
    const sorted = sessions.map(s => s.date.getTime()).sort((a, b) => a - b);
    const dataStart = sorted[0];
    const dataEnd = sorted[sorted.length - 1];
    const dataSpan = dataEnd - dataStart;

    const from = range && range.from ? new Date(range.from) : null;
    const to = range && range.to ? new Date(range.to + 'T23:59:59') : new Date();
    const requestedSpan = from ? (to.getTime() - from.getTime()) : dataSpan;
    const absSpan = requestedSpan > 0 ? requestedSpan : dataSpan;

    const inRange = (d) => (!from || d >= from) && d <= to;
    const inPrev = (d) => {
      const prevTo = from || new Date(dataEnd);
      const prevFrom = new Date(prevTo.getTime() - absSpan);
      return d >= prevFrom && d < prevTo;
    };

    const aggregate = (xs) => {
      if (!xs.length) return 0;
      if (agg === 'avg') return xs.reduce((a, b) => a + b, 0) / xs.length;
      if (agg === 'count') return xs.length;
      return xs.reduce((a, b) => a + b, 0);
    };

    const currentVals = sessions.filter(s => inRange(s.date)).map(s => Number(s[field]) || 0);
    const prevVals = sessions.filter(s => inPrev(s.date)).map(s => Number(s[field]) || 0);

    const current = aggregate(currentVals);
    const previous = aggregate(prevVals);
    const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

    return { current, previous, deltaPct };
  }
```

- [ ] **Step 2: Smoke test**

```bash
cd /home/william/gym-dashboard && node -e "
const m = require('module');
const fn = m.createRequire(process.cwd() + '/');
// IIFE wrapper não é exportável, copiamos manualmente
const sessions = [
  { date: new Date('2026-07-01'), volume: 1000 },
  { date: new Date('2026-07-15'), volume: 2000 },
  { date: new Date('2026-08-01'), volume: 3000 },
];
const r = computePeriodDelta(sessions, { from: null, to: null, label: 'all' }, 'volume');
console.log('all:', r);
const r30 = computePeriodDelta(sessions, { from: '2026-07-04', to: '2026-08-04' }, 'volume');
console.log('30d:', r30);
"
```

Esperado: `all` mostra `current=6000, previous=0, deltaPct=0` (período anterior sem dados). `30d` mostra `current=5000, previous=1000, deltaPct=400`.

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "fix(data): computePeriodDelta range 'all' usa span dos dados"
```

---

## Task 2: Persistir tab no URL

**Files:**
- Modify: `js/state.js` — adicionar `parseTabFromURL` + `syncTabToURL`
- Modify: `js/tabs.js` — corrigir bug do `window.App`

**Interfaces:**
- `State.parseTabFromURL()` retorna `'overview' | 'strength' | 'consistency' | 'history'`
- `State.syncTabToURL(name)` chama `history.replaceState`
- `Tabs.switch(name)` agora também chama `State.syncTabToURL(name)`

- [ ] **Step 1: Adicionar helpers em `js/state.js`** No final do arquivo, antes do `return`:

```js
function parseTabFromURL() {
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  return ['overview', 'strength', 'consistency', 'history'].includes(tab) ? tab : 'overview';
}

function syncTabToURL(name) {
  const url = new URL(location.href);
  if (url.searchParams.get('tab') === name) return;
  if (name === 'overview') {
    url.searchParams.delete('tab');
  } else {
    url.searchParams.set('tab', name);
  }
  history.replaceState({}, '', url);
}
```

Adicionar `parseTabFromURL, syncTabToURL` ao `return`.

- [ ] **Step 2: Corrigir `js/tabs.js`** Substituir a função `switchTo`:

```js
function switchTo(name) {
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.tab !== name;
  });
  document.querySelectorAll('.tabs-nav button[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  App.tab = name;
  if (window.State && window.State.syncTabToURL) window.State.syncTabToURL(name);
  document.dispatchEvent(new CustomEvent('gym:tabchange', { detail: { tab: name } }));
}
```

- [ ] **Step 3: No `js/main.js`, usar parseTabFromURL** Substituir `App.tab = parseRangeFromURL()`:

Adicionar antes do `App.range = parseRangeFromURL()`:

```js
App.tab = window.State.parseTabFromURL();
```

- [ ] **Step 4: Commit**

```bash
git add js/state.js js/tabs.js js/main.js
git commit -m "fix(tabs): persistir aba no URL via ?tab= param"
```

---

## Task 3: Modal a11y — role, aria-modal, Escape

**Files:**
- Modify: `js/ui.js:89-138`

- [ ] **Step 1: Adicionar atributos + listener** Em `openSessionModal`, substituir o bloco `overlay`:

```js
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

  closeBtn.addEventListener('click', () => { overlay.remove(); cleanup(); });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.remove(); cleanup(); }
  });

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.removedNodes) {
        if (n === overlay) { cleanup(); observer.disconnect(); }
      }
    }
  });
  observer.observe(document.body, { childList: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui.js
git commit -m "fix(ui): modal com role=dialog, aria-modal, Escape, focus restore"
```

---

## Task 4: KPI "Novos Recordes" usa classifyPRs

**Files:**
- Modify: `js/render.js:22-23` — onde conta `sessions.filter(...30 days)`

- [ ] **Step 1: Substituir contagem** Localizar a linha com `recentCutoff` e `newPRs`:

```js
    const recentCutoff = Date.now() - 30 * 86_400_000;
    const newPRs = sessions.filter(s => s.date && s.date.getTime() >= recentCutoff).length;
```

Substituir por:

```js
    const allPRs = window.Data.computePRs(App.rawSessions);
    const classified = window.Data.classifyPRs(allPRs);
    const newPRs = classified.new.length;
```

- [ ] **Step 2: Commit**

```bash
git add js/render.js
git commit -m "fix(render): KPI 'Novos Recordes' usa classifyPRs em vez de sessões"
```

---

## Task 5: Remover dead exports

**Files:**
- Modify: `js/data.js` — remover `computeStreak` do export
- Modify: `js/render.js:12` — remover `computeStreak` do destructure
- Modify: `js/tabs.js:8,32` — remover `t` do destructure e export

- [ ] **Step 1: data.js** No `return`, remover `computeStreak`. Manter a função internamente caso seja usada por outros arquivos (verificar via grep).

```bash
grep -rn "computeStreak" /home/william/gym-dashboard/js/
```

Se zero referências fora do próprio `data.js`, deletar função inteira. Senão, só remover do export.

- [ ] **Step 2: render.js:12** Remover `computeStreak` do destructure.

- [ ] **Step 3: tabs.js** Remover `const { t } = window.I18N;` e `t` do return.

- [ ] **Step 4: Smoke test**

```bash
node --check /home/william/gym-dashboard/js/data.js && \
node --check /home/william/gym-dashboard/js/render.js && \
node --check /home/william/gym-dashboard/js/tabs.js && echo "OK"
```

- [ ] **Step 5: Commit**

```bash
git add js/data.js js/render.js js/tabs.js
git commit -m "chore: remover computeStreak e Tabs.t dead exports"
```

---

## Task 6: Dedup `lastWorkout` writer

**Files:**
- Modify: `js/render.js:42-47` — remover bloco
- Modify: `js/main.js` — manter `updateTimestamps`

- [ ] **Step 1: Em `render.js`, localizar e remover** Bloco:

```js
    const updatedLast = document.getElementById('lastWorkout');
    if (updatedLast) {
      updatedLast.textContent = lastDate
        ? `${t('header.lastWorkout')}: ${lastDate.toLocaleDateString('pt-BR')}`
        : '';
    }
```

Render.js não escreve mais `#lastWorkout` — fica a cargo de `main.js:updateTimestamps`.

- [ ] **Step 2: Garantir `updateTimestamps` é chamado em range change** Em `js/main.js`, no listener `gym:rangechange`, `updateTimestamps(App.sessions)` já é chamado. OK.

- [ ] **Step 3: Smoke test**

```bash
grep -n "lastWorkout" /home/william/gym-dashboard/js/*.js
```

Deve mostrar apenas `js/main.js` (e nenhum em `render.js`).

- [ ] **Step 4: Commit**

```bash
git add js/render.js
git commit -m "refactor: deduplicar writer de #lastWorkout (apenas main.js)"
```

---

## Task 7: Wire `Tabs.init()` no fallback path

**Files:**
- Modify: `js/main.js:58` — também chamar `Tabs.init()` no catch

- [ ] **Step 1: Localizar o `catch` no `main()`** Após `showFileDropZone()`:

```js
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      const { kpiCard } = window.UI;
      const kpis = document.getElementById('kpis');
      if (kpis) {
        kpis.replaceChildren(
          kpiCard('!', window.I18N.t('error.load')),
        );
      }
      showFileDropZone();
    }
```

- [ ] **Step 2: Adicionar `Tabs.init()`** Após `showFileDropZone()`:

```js
      window.Tabs.init();
```

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "fix(main): Tabs.init no fallback path (file:// + erro fetch)"
```

---

## Task 8: Verificação end-to-end + push

- [ ] **Step 1: Server + Playwright**

```bash
cd /home/william/gym-dashboard
nohup python3 -m http.server 8770 > /tmp/gym_srv2.log 2>&1 < /dev/null &
disown
sleep 1.5
curl -sI http://localhost:8770/ | head -1
```

- [ ] **Step 2: Playwright navegar**

```bash
mcp__plugin_playwright_playwright__browser_navigate http://localhost:8770/
```

- [ ] **Step 3: Validar visualmente via snapshot** Confirmar: 4 KPIs, 4 abas, summary, period picker.

- [ ] **Step 4: Trocar aba "Força" via JS** `document.querySelector('[data-tab=strength]').click()` → URL deve ficar `?tab=strength` + painel "strength" visível.

- [ ] **Step 5: Trocar aba "Consistência" + Reload** URL `?tab=consistency`. Refresh. Deve voltar em `consistency`.

- [ ] **Step 6: Modal Escape** Clicar numa sessão, depois pressionar Escape. Modal deve fechar.

- [ ] **Step 7: KPIs em range 'all'** Default load. KPIs devem mostrar comparação real (não 0%).

- [ ] **Step 8: Commit final + push**

```bash
git add -A
git commit --allow-empty -m "chore: pass 2 verification"
git push origin main
```

- [ ] **Step 9: Limpar server**

```bash
pkill -f "http.server 8770"
```

---

## Critical files modified

- `js/data.js` — `computePeriodDelta` fix, dead export removal
- `js/state.js` — `parseTabFromURL`, `syncTabToURL`
- `js/tabs.js` — bug fix `window.App`, sync URL
- `js/main.js` — usar parseTabFromURL, Tabs.init no catch
- `js/ui.js` — modal a11y
- `js/render.js` — KPI fix, dedup, dead destructure removal

## Verification (end-to-end)

1. `nohup python3 -m http.server 8770 &` em `/home/william/gym-dashboard`
2. Playwright navega `http://localhost:8770/`
3. Snapshot confirma 4 KPIs + summary + abas
4. Click em aba "Força" → URL tem `?tab=strength` + painel correto
5. Reload mantém aba via URL
6. Modal abre, Escape fecha
7. Range "Tudo" mostra delta real (não 0% flat)
8. `git push origin main` OK