# Plano Completo — Gym Dashboard v3

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar todas as features restantes do roadmap (F1/F4/F5/U5/F6), limpeza de dados (D2), segurança (S2/S3), performance (lazy load), e polish (mobile audit). Transformar o dashboard de "bom pessoal" para "profissional".

**Architecture:** Preserva módulos vanilla JS atuais. Adiciona novos módulos `js/rpe.js`, `js/coach.js`, `js/measurements.js`, `js/export.js`, `js/comparator.js`. Refatora `render.js` para lazy load. Limpa JSONs órfãos.

**Tech Stack:** Vanilla JS + Chart.js 4.4.7 (CDN) + html2canvas (CDN, para F6). Sem build, sem deps novas.

---

## Fase 1: D2 — Limpeza de dados + JSONs usados

### Task 1: Mapear JSONs usados vs órfãos

- [ ] **Step 1: Auditoria**

JSONs atualmente consumidos pelo app:
- `WorkoutSession.json` (4.4 MB) — fonte principal
- `CoachWorkout.json` (1.5 MB) — aderência ao coach
- `WorkoutSessionSet.json` (1 MB) — será usado para F1 (RPE)
- `Exercise.json` (800 KB) — thumbnails nos cards (dado review U4)

JSONs a manter (serão usados em futuras tasks):
- `WorkoutSession.json`
- `WorkoutSessionSet.json` (F1 RPE)
- `CoachWorkout.json` (F4 coach adherence)
- `Exercise.json` (thumbnails)
- `Measurement.json` (F5 medidas)
- `MeasurementLog.json` (F5 medidas)

JSONs a deletar (órfãos):
- `Bar.json` (4 KB)
- `ExerciseNotes.json` (4 KB)
- `MuscleGroup.json` (4 KB)
- `Plate.json` (4 KB)
- `Reminder.json` (4 KB)
- `StatisticsExercise.json` (4 KB)
- `User.json` (4 KB)
- `Equipment.json` (12 KB)
- `Link.json` (108 KB)
- `WorkoutExerciseSet.json` (480 KB)
- `CoachAssessment.json` (732 KB)
- `UserPreferences.json` (1.6 MB)
- `Schedule.json` (1.7 MB)
- `Workout.json` (1.9 MB)
- `WorkoutExercise.json` (2.1 MB)
- `WorkoutSessionExercise.json` (3.1 MB)

Economia total: ~12 MB removidos.

- [ ] **Step 2: Deletar órfãos**

```bash
cd /home/william/gym-dashboard/data
git rm Bar.json ExerciseNotes.json MuscleGroup.json Plate.json Reminder.json \
  StatisticsExercise.json User.json Equipment.json Link.json \
  WorkoutExerciseSet.json CoachAssessment.json UserPreferences.json \
  Schedule.json Workout.json WorkoutExercise.json WorkoutSessionExercise.json
```

- [ ] **Step 3: Atualizar SCHEMAS.md** Remover entradas dos JSONs deletados.

- [ ] **Step 4: Atualizar .gitignore** Adicionar `archive/` se ainda não estiver.

- [ ] **Step 5: Commit**

---

## Fase 2: S2/S3 — Segurança

### Task 2: S3 — CSP meta tag

- [ ] **Step 1: Adicionar `<meta>` CSP** Em `index.html`, no `<head>`, após `<title>`:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
    script-src 'self' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src https://fonts.gstatic.com;
    img-src 'self' https://d3r2akiggou3b8.cloudfront.net data:;
    connect-src 'self';
    style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com;">
```

- [ ] **Step 2: Verificar que não quebra nada** DevTools Console: zero CSP violations.

- [ ] **Step 3: Commit**

### Task 3: S2 — Validar drop de arquivo

- [ ] **Step 1: Atualizar `js/drop.js`**

Adicionar validação de tamanho e MIME:

```js
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
if (file.size > MAX_SIZE) {
  showError(`Arquivo muito grande (${(file.size / 1e6).toFixed(1)} MB). Máximo: 50 MB.`);
  return;
}
if (!file.name.endsWith('.json')) {
  showError('Formato inválido. Envie um arquivo .json.');
  return;
}
```

- [ ] **Step 2: Mensagem de erro elegante** Substituir `alert()` por `UI.showError(msg)` se não existir.

- [ ] **Step 3: Commit**

---

## Fase 3: F1 — RPE × %1RM scatter plot

### Task 4: Ler WorkoutSessionSet.json

- [ ] **Step 1: Criar `js/rpe.js`**

```js
window.RPE = (function () {
  async function load() {
    const res = await fetch('data/WorkoutSessionSet.json');
    if (!res.ok) return [];
    return await res.json();
  }
  return { load };
})();
```

- [ ] **Step 2: Carregar no `index.html`** Antes de `render.js`:
```html
<script defer src="js/rpe.js"></script>
```

- [ ] **Step 3: Commit**

### Task 5: Scatter plot RPE × %1RM

- [ ] **Step 1: Em `render.js`**, adicionar `renderRPEChart(sets, sessions)`

Cada set tem `rpe`, `weight`, `oneRepMax`. Plot: eixo X = %1RM, eixo Y = RPE, cor = exercício.

- [ ] **Step 2: Adicionar canvas + aba "Força"** No `<section data-tab="strength">`:

```html
<div class="chart-box">
  <h2>Intensidade: RPE × %1RM</h2>
  <canvas id="rpeChart"></canvas>
</div>
```

- [ ] **Step 3: Tooltip** Mostrar nome do exercício + data.

- [ ] **Step 4: Commit**

---

## Fase 4: F4 — Coach adherence expandida

### Task 6: CoachWorkout.json + tabela

- [ ] **Step 1: Criar `js/coach.js`**

```js
window.Coach = (function () {
  async function load() {
    const res = await fetch('data/CoachWorkout.json');
    if (!res.ok) return [];
    return await res.json();
  }
  function computeAdherence(coach, actual) {
    // coach: array de workouts planejados
    // actual: array de sessões reais
    // Retorna { planned, completed, adherencePercent }
  }
  return { load, computeAdherence };
})();
```

- [ ] **Step 2: Adicionar aba "Consistência"** No `<section data-tab="consistency">`:

```html
<section class="chart-box">
  <h2>Aderência ao Treino Planejado</h2>
  <table id="coachTable">...</table>
</section>
```

- [ ] **Step 3: Score de aderência 0-100** Badge verde/amarelo/vermelho.

- [ ] **Step 4: Commit**

---

## Fase 5: F5 — Body measurements dashboard

### Task 7: Measurement.json + gráficos

- [ ] **Step 1: Criar `js/measurements.js`**

```js
window.Measurements = (function () {
  async function load() {
    const [m, ml] = await Promise.all([
      fetch('data/Measurement.json').then(r => r.ok ? r.json() : []),
      fetch('data/MeasurementLog.json').then(r => r.ok ? r.json() : []),
    ]);
    return { measurements: m, logs: ml };
  }
  return { load };
})();
```

- [ ] **Step 2: Adicionar aba "Medidas"** ou seção em "Histórico":

```html
<section class="chart-box" data-tab="history">
  <h2>Evolução Corporal</h2>
  <canvas id="measurementsChart"></canvas>
</section>
```

- [ ] **Step 3: Gráfico multi-line** Peso, % gordura, circunferências (se dados existirem).

- [ ] **Step 4: Commit**

---

## Fase 6: U5 — Comparador de exercícios

### Task 8: Comparador multi-select

- [ ] **Step 1: Em `js/render.js`**, adicionar `renderComparisonChart(exercises, sessions)`

Multi-select de exercícios → linha por exercício no mesmo eixo.

- [ ] **Step 2: Canvas + botão**:

```html
<div class="chart-box">
  <h2>Comparar Exercícios</h2>
  <div class="comparison-select" id="comparisonSelect"></div>
  <canvas id="comparisonChart"></canvas>
</div>
```

- [ ] **Step 3: Max 5 exercícios selecionáveis** Limite para legibilidade.

- [ ] **Step 4: Commit**

---

## Fase 7: F6 — Export PNG + share link

### Task 9: Export PNG (html2canvas)

- [ ] **Step 1: Carregar html2canvas** Em `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
  integrity="sha384-..."
  crossorigin="anonymous"></script>
```

- [ ] **Step 2: Criar `js/export.js`**

```js
window.Export = (function () {
  async function toPNG() {
    const el = document.querySelector('.wrap');
    const canvas = await html2canvas(el, { backgroundColor: '#0f0f0f' });
    const link = document.createElement('a');
    link.download = `gym-evolucao-${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
  function shareURL() {
    const url = location.href;
    navigator.clipboard?.writeText(url);
    return url;
  }
  return { toPNG, shareURL };
})();
```

- [ ] **Step 3: Botão no header**:

```html
<button id="exportBtn" class="hero-action" title="Exportar PNG">📸</button>
<button id="shareBtn" class="hero-action" title="Copiar link">🔗</button>
```

- [ ] **Step 4: Commit**

---

## Fase 8: Lazy load por IntersectionObserver

### Task 10: IntersectionObserver nos charts

- [ ] **Step 1: Em `js/render.js`**, wrappear criação de Chart.js:

```js
const chartObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.querySelector('canvas')?.id;
      if (id && window._lazyCharts && window._lazyCharts[id]) {
        window._lazyCharts[id]();
        delete window._lazyCharts[id];
        chartObserver.unobserve(entry.target);
      }
    }
  });
}, { rootMargin: '200px' });
```

- [ ] **Step 2: Registrar cada chart box** `chartObserver.observe(chartBoxEl)` quando renderiza.

- [ ] **Step 3: Verificar que chart não cria antes de scroll** Teste: console log no chart creation.

- [ ] **Step 4: Commit**

---

## Fase 9: Mobile audit

### Task 11: Breakpoint 375px

- [ ] **Step 1: Playwright resize 375×812** Navegar, screenshot, verificar overflow.

- [ ] **Step 2: Fix grid** `grid-template-columns: 1fr` em charts, `grid-template-columns: 1fr 1fr` em KPIs.

- [ ] **Step 3: Fix table** `#sessionsTable` display none + `.sessions-cards` flex col (já feito, validar).

- [ ] **Step 4: Fix modal** `.modal-content { padding: 16px; max-width: 100%; }` em 375px.

- [ ] **Step 5: Fix tabs** Tabs scroll horizontal (já tem `overflow-x: auto`, validar).

- [ ] **Step 6: Playwright resize 768×1024** Tablet.

- [ ] **Step 7: Commit**

---

## Fase 10: Persistir state em localStorage

### Task 12: Range + tab em localStorage

- [ ] **Step 1: Em `js/state.js`**, adicionar persistência:

```js
function persistState() {
  try {
    localStorage.setItem('gym-dashboard', JSON.stringify({
      range: App.range,
      tab: App.tab,
    }));
  } catch {}
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('gym-dashboard'));
    if (saved?.range) App.range = saved.range;
    if (saved?.tab) App.tab = saved.tab;
  } catch {}
}
```

- [ ] **Step 2: Chamar `persistState()` em `rerender()`** e no `gym:rangechange` listener.

- [ ] **Step 3: Chamar `loadState()` antes de `parseRangeFromURL()`** URL > localStorage.

- [ ] **Step 4: Commit**

---

## Fase 11: Merge + push final

### Task 13: Push + verificação

- [ ] **Step 1: Todos os commits**

- [ ] **Step 2: Git log completo**

- [ ] **Step 3: `git push origin main`**

- [ ] **Step 4: Server local + Playwright E2E**

---

## Critical files modified

- `data/*.json` — deletar 16 arquivos órfãos (~12 MB)
- `data/SCHEMAS.md` — atualizar
- `index.html` — CSP, html2canvas, botões export/share, lazy load
- `js/state.js` — localStorage persist
- `js/render.js` — RPE chart, comparison chart, lazy load observer
- `js/data.js` — carregar WorkoutSessionSet.json
- `js/ui.js` — showError, modal refinements
- `js/rpe.js` (novo) — RPE loader
- `js/coach.js` (novo) — Coach adherence
- `js/measurements.js` (novo) — Body measurements
- `js/export.js` (novo) — PNG export + share

## Verification (end-to-end)

1. `python3 -m http.server 8800` em `/home/william/gym-dashboard`
2. Playwright: `http://localhost:8800/`
3. Verificar: dashboard carrega, zero erros console, zero CSP violations
4. Clicar cada aba — charts lazy load (console log)
5. Click numa sessão — modal com exercícios
6. Botão export — download PNG
7. Botão share — URL copiada
8. Resize 375px — layout mobile correto
9. Reload — range + tab persistidos
10. `git push origin main`