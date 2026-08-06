# Refactor de IA, prescrição e refinamento visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o dashboard em duas abas nomeadas pelo momento de uso ("Hoje" prescritivo, "Evolução" analítico), adicionar recência por grupo muscular e sugestão de carga, e refinar o visual dentro da identidade escuro+vermelho.

**Architecture:** Duas funções puras novas (`Muscles`, `Prescribe`) sem DOM, testáveis com `node --test`, consumidas por duas seções novas (`today.js`, `evolution.js`) que seguem o padrão de `js/sections/` já existente. `render.js` continua como façade e encolhe. CSS dividido em quatro arquivos por responsabilidade, sem build.

**Tech Stack:** HTML/CSS/JS vanilla, sem bundler. Namespaces globais em `window`. Chart.js 4.5.1 via CDN com SRI. Testes com `node --test`, zero dependências. Verificação em browser real via Playwright.

## Global Constraints

- **Sem build step e sem `node_modules` em runtime.** Os módulos atacham em `window` e a ordem das tags `<script>` no `index.html` importa.
- **Paleta não muda.** Cores de série vêm de `window.Charts.palette`; nunca declare constante de cor em módulo novo. A ordem dos oito slots é o mecanismo de segurança para daltonismo — reordenar exige revalidar.
- **Gráfico de série única usa `palette.series[0]`.**
- **Faixa de repetições padrão quando ausente: `(8, 12)`.** É a faixa em 2.323 de 2.359 séries do dataset.
- **Incremento padrão quando não há histórico no exercício: `2.5` kg.**
- **Lacuna máxima para sugerir carga: `180` dias.** Acima disso, mostrar última carga sem sugestão.
- **Nenhuma sugestão sem pelo menos uma sessão anterior registrada** para aquele exercício.
- **Toda sugestão aparece ao lado do que foi feito**, nunca sozinha.
- **Textos em pt-BR**, sentence case, sem ponto final em rótulo.
- Testes rodam com `npm test`. Os 117 testes atuais precisam continuar passando.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `js/muscles.js` (novo) | Recência por grupo muscular. Função pura, sem DOM. |
| `js/prescribe.js` (novo) | Regra de dupla progressão. Função pura, sem DOM. |
| `js/sections/today.js` (novo) | Renderiza a aba "Hoje" |
| `js/sections/evolution.js` (novo) | Orquestra as seções analíticas |
| `css/tokens.css` (novo) | Custom properties: cor, tipo, espaçamento, raio |
| `css/base.css` (novo) | Reset, elementos, utilitários |
| `css/components.css` (novo) | kpi, chart-box, tabela, modal, toast, streak |
| `css/sections.css` (novo) | Hero, tabs, hoje, evolução, responsivo |
| `index.html` | Duas abas; seletor de período move para "Evolução" |
| `js/render.js` | Façade encolhe |
| `tests/muscles.test.js`, `tests/prescribe.test.js` (novos) | Cobertura das funções puras |

---

### Task 1: Recência por grupo muscular

**Files:**
- Create: `js/muscles.js`
- Test: `tests/muscles.test.js`

**Interfaces:**
- Consumes: nada (função pura)
- Produces: `window.Muscles.recencyByGroup(rawSessions, now)` → `Array<{group: string, lastDate: Date, daysSince: number, exercises: string[]}>`, ordenado por `daysSince` decrescente (mais atrasado primeiro). `exercises` são os nomes distintos já treinados naquele grupo, ordenados por frequência decrescente.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/muscles.test.js`:

```js
/**
 * tests/muscles.test.js — Recência por grupo muscular
 *
 * js/muscles.js atacha em `window`, então carregamos via eval num window
 * simulado, igual a tests/pure-fns.test.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

globalThis.window = globalThis;
eval(readFileSync(resolve(root, 'js/muscles.js'), 'utf8'));
const M = globalThis.Muscles;
assert.ok(M, 'window.Muscles não exportou');

const sessao = (startDate, exercicios) => ({
  id: `s-${startDate}`,
  startDate,
  workoutSessionExercises: exercicios,
});
const exercicio = (name, grupos) => ({
  exercise: { name, primaryMuscleGroups: grupos.map(g => ({ name: g })) },
  workoutSessionSets: [{ isComplete: true, weight: 50, reps: 10 }],
});

describe('recencyByGroup', () => {
  const agora = new Date('2026-08-10T12:00:00Z');

  it('ordena do mais atrasado para o mais recente', () => {
    const r = M.recencyByGroup([
      sessao('2026-08-08T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
      sessao('2026-06-10T10:00:00Z', [exercicio('Supino', ['Chest'])]),
    ], agora);
    assert.equal(r[0].group, 'Chest');
    assert.equal(r[1].group, 'Lats');
  });

  it('calcula daysSince em dias de calendário', () => {
    const r = M.recencyByGroup(
      [sessao('2026-08-08T22:00:00Z', [exercicio('Puxada', ['Lats'])])],
      agora,
    );
    assert.equal(r[0].daysSince, 2);
  });

  it('usa a sessão MAIS RECENTE quando o grupo aparece várias vezes', () => {
    const r = M.recencyByGroup([
      sessao('2026-01-01T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
      sessao('2026-08-09T10:00:00Z', [exercicio('Remada', ['Lats'])]),
    ], agora);
    assert.equal(r.length, 1);
    assert.equal(r[0].daysSince, 1);
  });

  it('lista exercícios do grupo por frequência decrescente', () => {
    const r = M.recencyByGroup([
      sessao('2026-08-01T10:00:00Z', [exercicio('Remada', ['Lats'])]),
      sessao('2026-08-02T10:00:00Z', [exercicio('Remada', ['Lats'])]),
      sessao('2026-08-03T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
    ], agora);
    assert.deepEqual(r[0].exercises, ['Remada', 'Puxada']);
  });

  it('um exercício com dois grupos conta para os dois', () => {
    const r = M.recencyByGroup(
      [sessao('2026-08-09T10:00:00Z', [exercicio('Supino', ['Chest', 'Triceps'])])],
      agora,
    );
    assert.deepEqual(r.map(x => x.group).sort(), ['Chest', 'Triceps']);
  });

  it('exercício sem grupo muscular não quebra e não vira grupo', () => {
    const semGrupo = { exercise: { name: 'Alongamento' }, workoutSessionSets: [] };
    const r = M.recencyByGroup(
      [sessao('2026-08-09T10:00:00Z', [semGrupo, exercicio('Puxada', ['Lats'])])],
      agora,
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].group, 'Lats');
  });

  it('lista vazia devolve array vazio', () => {
    assert.deepEqual(M.recencyByGroup([], agora), []);
    assert.deepEqual(M.recencyByGroup(null, agora), []);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test tests/muscles.test.js`
Expected: FAIL com "Cannot find module '.../js/muscles.js'"

- [ ] **Step 3: Implementação mínima**

Criar `js/muscles.js`:

```js
/**
 * js/muscles.js — Recência por grupo muscular
 *
 * Namespace: window.Muscles
 *
 * Função pura: entra a lista crua de sessões, sai quanto tempo faz que cada
 * grupo muscular foi treinado. É o que responde "o que treinar hoje" — o dado
 * já estava carregado, o app é que nunca perguntava isso a ele.
 *
 * 895 dos 899 exercícios do dataset têm primaryMuscleGroups; os 4 sem grupo
 * são ignorados em vez de virarem um grupo "desconhecido" que ninguém treina.
 */
window.Muscles = (function () {
  const DAY_MS = 86_400_000;

  /** Meia-noite local, para comparar dias de calendário e não instantes. */
  function midnight(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function recencyByGroup(rawSessions, now) {
    const hoje = midnight(now ?? new Date());
    const porGrupo = new Map(); // grupo -> { lastDate, contagem: Map(exercicio -> n) }

    for (const sessao of rawSessions ?? []) {
      const data = sessao.startDate ? new Date(sessao.startDate) : null;
      if (!data || Number.isNaN(data.getTime())) continue;

      for (const ex of sessao.workoutSessionExercises ?? []) {
        const nome = ex.exercise?.name;
        const grupos = ex.exercise?.primaryMuscleGroups ?? [];
        if (!nome || !grupos.length) continue;

        for (const g of grupos) {
          const grupo = g?.name;
          if (!grupo) continue;
          let registro = porGrupo.get(grupo);
          if (!registro) {
            registro = { lastDate: data, contagem: new Map() };
            porGrupo.set(grupo, registro);
          }
          if (data > registro.lastDate) registro.lastDate = data;
          registro.contagem.set(nome, (registro.contagem.get(nome) ?? 0) + 1);
        }
      }
    }

    return [...porGrupo.entries()]
      .map(([group, { lastDate, contagem }]) => ({
        group,
        lastDate,
        daysSince: Math.round((hoje - midnight(lastDate)) / DAY_MS),
        exercises: [...contagem.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([nome]) => nome),
      }))
      .sort((a, b) => b.daysSince - a.daysSince || a.group.localeCompare(b.group));
  }

  return { recencyByGroup };
})();
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test tests/muscles.test.js`
Expected: PASS, 7 testes

- [ ] **Step 5: Confirmar que a suíte inteira segue verde**

Run: `npm test`
Expected: os 117 anteriores + 7 novos = 124 passando, 0 falhando

- [ ] **Step 6: Commit**

```bash
git add js/muscles.js tests/muscles.test.js
git commit -m "feat(muscles): recência por grupo muscular"
```

---

### Task 2: Regra de dupla progressão

**Files:**
- Create: `js/prescribe.js`
- Test: `tests/prescribe.test.js`

**Interfaces:**
- Consumes: nada (função pura)
- Produces:
  - `window.Prescribe.usualIncrement(rawSessions, exerciseName)` → `number`. Menor incremento positivo de carga que o usuário já aplicou naquele exercício entre sessões consecutivas; `2.5` se não houver nenhum.
  - `window.Prescribe.suggest(rawSessions, exerciseName, now)` → `{status, lastDate, daysSince, lastWeight, lastReps, suggestedWeight, targetReps, increment}` ou `null` quando o exercício nunca apareceu. `status` ∈ `'raise' | 'hold' | 'stale'`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/prescribe.test.js`:

```js
/**
 * tests/prescribe.test.js — Regra de dupla progressão
 *
 * A regra não foi inventada: 80% das séries do dataset têm faixa de repetições
 * explícita (8–12 em praticamente todas) e os incrementos de carga realmente
 * usados são +5, +1, +2 e +10 kg. O teste cobre o contrato dessa regra.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

globalThis.window = globalThis;
eval(readFileSync(resolve(root, 'js/prescribe.js'), 'utf8'));
const P = globalThis.Prescribe;
assert.ok(P, 'window.Prescribe não exportou');

const serie = (weight, reps, minReps = 8, maxReps = 12) => ({
  isComplete: true, warmUp: false, weight, reps, minReps, maxReps,
});
const sessao = (startDate, nome, sets) => ({
  id: `s-${startDate}`,
  startDate,
  workoutSessionExercises: [{ exercise: { name: nome }, workoutSessionSets: sets }],
});

const agora = new Date('2026-08-10T12:00:00Z');

describe('usualIncrement', () => {
  it('usa o MENOR incremento positivo já aplicado no exercício', () => {
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-01-08T10:00:00Z', 'Supino', [serie(55, 10)]),
      sessao('2026-01-15T10:00:00Z', 'Supino', [serie(57, 10)]),
    ];
    assert.equal(P.usualIncrement(s, 'Supino'), 2);
  });

  it('cai para 2.5 quando o exercício nunca subiu de carga', () => {
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-01-08T10:00:00Z', 'Supino', [serie(50, 10)]),
    ];
    assert.equal(P.usualIncrement(s, 'Supino'), 2.5);
  });

  it('ignora o histórico de outros exercícios', () => {
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Agachamento', [serie(100, 10)]),
      sessao('2026-01-08T10:00:00Z', 'Agachamento', [serie(110, 10)]),
    ];
    assert.equal(P.usualIncrement(s, 'Supino'), 2.5);
  });
});

describe('suggest', () => {
  it('bateu o topo da faixa em todas as séries → sobe a carga e volta ao piso', () => {
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-08-08T10:00:00Z', 'Supino', [serie(55, 12), serie(55, 12)]),
    ];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'raise');
    assert.equal(r.lastWeight, 55);
    assert.equal(r.increment, 5);
    assert.equal(r.suggestedWeight, 60);
    assert.equal(r.targetReps, 8);
  });

  it('uma série abaixo do topo → mantém a carga e mira uma repetição a mais', () => {
    const s = [sessao('2026-08-08T10:00:00Z', 'Supino', [serie(55, 12), serie(55, 10)])];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'hold');
    assert.equal(r.suggestedWeight, 55);
    assert.equal(r.targetReps, 11);
  });

  it('sem faixa registrada assume 8–12', () => {
    const semFaixa = { isComplete: true, warmUp: false, weight: 40, reps: 12 };
    const r = P.suggest([sessao('2026-08-08T10:00:00Z', 'Rosca', [semFaixa])], 'Rosca', agora);
    assert.equal(r.status, 'raise');
    assert.equal(r.targetReps, 8);
  });

  it('lacuna maior que 180 dias → status stale, sem sugestão de carga', () => {
    const s = [sessao('2025-01-01T10:00:00Z', 'Supino', [serie(55, 12)])];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'stale');
    assert.equal(r.suggestedWeight, null);
    assert.ok(r.daysSince > 180);
    assert.equal(r.lastWeight, 55);
  });

  it('exercício que nunca apareceu devolve null', () => {
    assert.equal(P.suggest([], 'Supino', agora), null);
    assert.equal(P.suggest(null, 'Supino', agora), null);
  });

  it('ignora aquecimento e séries incompletas', () => {
    const aquecimento = { isComplete: true, warmUp: true, weight: 20, reps: 15, minReps: 8, maxReps: 12 };
    const incompleta = { isComplete: false, warmUp: false, weight: 90, reps: 3, minReps: 8, maxReps: 12 };
    const r = P.suggest(
      [sessao('2026-08-08T10:00:00Z', 'Supino', [aquecimento, incompleta, serie(55, 12)])],
      'Supino', agora,
    );
    assert.equal(r.lastWeight, 55);
    assert.equal(r.status, 'raise');
  });

  it('usa apenas a ÚLTIMA sessão do exercício para decidir', () => {
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Supino', [serie(55, 12)]),
      sessao('2026-08-08T10:00:00Z', 'Supino', [serie(55, 9)]),
    ];
    assert.equal(P.suggest(s, 'Supino', agora).status, 'hold');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test tests/prescribe.test.js`
Expected: FAIL com "Cannot find module '.../js/prescribe.js'"

- [ ] **Step 3: Implementação mínima**

Criar `js/prescribe.js`:

```js
/**
 * js/prescribe.js — Sugestão de carga por dupla progressão
 *
 * Namespace: window.Prescribe
 *
 * A regra NÃO foi inventada: é a que o próprio histórico mostra. 80% das séries
 * têm faixa de repetições explícita e a faixa é 8–12 em 2.323 de 2.359 casos; os
 * incrementos de carga realmente aplicados são +5, +1, +2 e +10 kg. Então a
 * sugestão segue a prática registrada, e o incremento sai do histórico DAQUELE
 * exercício em vez de um valor fixo escolhido por nós.
 *
 * Conservadora de propósito: sem histórico não sugere, e acima de 180 dias de
 * lacuna também não — a premissa de continuidade deixa de valer. Sugestão de
 * carga errada num app de treino é pior que nenhuma sugestão.
 */
window.Prescribe = (function () {
  const DAY_MS = 86_400_000;
  const FAIXA_PADRAO = { min: 8, max: 12 };
  const INCREMENTO_PADRAO = 2.5;
  const LACUNA_MAXIMA_DIAS = 180;

  function midnight(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** Séries que contam: concluídas, não-aquecimento, com peso e reps válidos. */
  function seriesDeTrabalho(ex) {
    return (ex.workoutSessionSets ?? []).filter(s =>
      s.isComplete && !s.warmUp &&
      typeof s.weight === 'number' && s.weight > 0 &&
      typeof s.reps === 'number' && s.reps > 0);
  }

  /** Sessões em que o exercício aparece com trabalho real, mais antiga primeiro. */
  function historico(rawSessions, exerciseName) {
    const saida = [];
    for (const sessao of rawSessions ?? []) {
      const data = sessao.startDate ? new Date(sessao.startDate) : null;
      if (!data || Number.isNaN(data.getTime())) continue;
      for (const ex of sessao.workoutSessionExercises ?? []) {
        if (ex.exercise?.name !== exerciseName) continue;
        const sets = seriesDeTrabalho(ex);
        if (sets.length) saida.push({ date: data, sets });
      }
    }
    return saida.sort((a, b) => a.date - b.date);
  }

  function usualIncrement(rawSessions, exerciseName) {
    const h = historico(rawSessions, exerciseName);
    let menor = null;
    for (let i = 1; i < h.length; i++) {
      const anterior = Math.max(...h[i - 1].sets.map(s => s.weight));
      const atual = Math.max(...h[i].sets.map(s => s.weight));
      const diferenca = atual - anterior;
      if (diferenca > 0 && (menor === null || diferenca < menor)) menor = diferenca;
    }
    return menor ?? INCREMENTO_PADRAO;
  }

  function suggest(rawSessions, exerciseName, now) {
    const h = historico(rawSessions, exerciseName);
    if (!h.length) return null;

    const ultima = h[h.length - 1];
    const hoje = midnight(now ?? new Date());
    const daysSince = Math.round((hoje - midnight(ultima.date)) / DAY_MS);

    const peso = Math.max(...ultima.sets.map(s => s.weight));
    const noPeso = ultima.sets.filter(s => s.weight === peso);
    const min = noPeso[0].minReps ?? FAIXA_PADRAO.min;
    const max = noPeso[0].maxReps ?? FAIXA_PADRAO.max;
    const menorReps = Math.min(...noPeso.map(s => s.reps));

    const base = {
      lastDate: ultima.date,
      daysSince,
      lastWeight: peso,
      lastReps: menorReps,
      increment: null,
      suggestedWeight: null,
      targetReps: null,
    };

    if (daysSince > LACUNA_MAXIMA_DIAS) return { ...base, status: 'stale' };

    if (noPeso.every(s => s.reps >= max)) {
      const increment = usualIncrement(rawSessions, exerciseName);
      return {
        ...base,
        status: 'raise',
        increment,
        suggestedWeight: Math.round((peso + increment) * 100) / 100,
        targetReps: min,
      };
    }

    return {
      ...base,
      status: 'hold',
      suggestedWeight: peso,
      targetReps: Math.min(menorReps + 1, max),
    };
  }

  return { usualIncrement, suggest };
})();
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test tests/prescribe.test.js`
Expected: PASS, 11 testes

- [ ] **Step 5: Confirmar a suíte inteira**

Run: `npm test`
Expected: 135 passando, 0 falhando

- [ ] **Step 6: Commit**

```bash
git add js/prescribe.js tests/prescribe.test.js
git commit -m "feat(prescribe): sugestão de carga por dupla progressão"
```

---

### Task 3: Tokens de tipo e espaçamento

**Files:**
- Create: `css/tokens.css`
- Modify: `css/style.css` (remove o bloco `:root`, adiciona `@import`)

**Interfaces:**
- Produces: custom properties `--text-xs` … `--text-3xl` e `--space-1` … `--space-10`, além dos tokens de cor já existentes movidos sem alteração de valor.

- [ ] **Step 1: Criar o arquivo de tokens**

Criar `css/tokens.css` copiando o `:root` atual de `css/style.css` **sem alterar nenhum valor de cor**, e acrescentando as duas escalas novas:

```css
/* ==========================================================================
   Tokens — a única fonte de verdade para cor, tipo e espaço.
   Cores copiadas sem alteração: a paleta é validada para contraste e CVD.
   ========================================================================== */
:root {
  color-scheme: dark;

  /* Cor — não altere sem revalidar (ver README § Cores dos gráficos) */
  --bg: #07080a;
  --bg-soft: #0b0d10;
  --surface: #101318;
  --surface-raised: #151920;
  --surface-hover: #1a1f27;
  --text: #f5f7fa;
  --text-soft: #d6dbe3;
  --muted: #89919d;
  --muted-strong: #aab2bd;
  --accent: #ef3d57;
  --accent-hover: #ff4d67;
  --accent-soft: rgba(239, 61, 87, 0.11);
  --accent-border: rgba(239, 61, 87, 0.32);
  --accent-strong: #d42a45;
  --heat-1: #9a0000;
  --heat-2: #bb0016;
  --heat-3: #dd0033;
  --heat-4: #fe324d;
  --status-good: #0ca30c;
  --status-serious: #ec835a;
  --success: #35c983;
  --success-soft: rgba(53, 201, 131, 0.11);
  --warning: #f5ad42;
  --warning-soft: rgba(245, 173, 66, 0.11);
  --danger: #ef5350;
  --border: rgba(255, 255, 255, 0.075);
  --border-strong: rgba(255, 255, 255, 0.13);

  /* Tipo — degraus declarados. O número é o conteúdo, então ele ocupa o topo. */
  --text-xs: 0.7rem;
  --text-sm: 0.78rem;
  --text-base: 0.88rem;
  --text-md: 1rem;
  --text-lg: 1.15rem;
  --text-xl: clamp(1.4rem, 2.2vw, 1.7rem);
  --text-2xl: clamp(1.7rem, 3vw, 2.45rem);
  --text-3xl: clamp(2rem, 3.4vw, 2.9rem);

  /* Espaço — escala de 4 px. Substitui os avulsos (13, 17, 19, 21 px) que
     produziam ritmo vertical inconsistente. */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  --radius-sm: 9px;
  --radius-md: 13px;
  --radius-lg: 17px;
  --radius-xl: 22px;
  --shadow-sm: 0 8px 24px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 20px 60px rgba(0, 0, 0, 0.34);
  --content-width: 1360px;
  --transition: 170ms ease;
}
```

- [ ] **Step 2: Apontar `style.css` para os tokens**

Em `css/style.css`, apagar todo o bloco `:root { … }` do topo e pôr, como **primeira linha do arquivo** (`@import` precisa vir antes de qualquer regra):

```css
@import url("tokens.css");
```

- [ ] **Step 3: Verificar que nada quebrou visualmente**

Run: `python3 -m http.server 8000` e abrir `http://localhost:8000`
Expected: idêntico ao anterior. Confirmar no console do browser que nenhuma custom property ficou vazia:

```js
[...new Set([...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } }).flatMap(r => (r.cssText||'').match(/var\(--[a-z0-9-]+/g) || []))]
  .map(t => t.slice(4))
  .filter(t => !getComputedStyle(document.documentElement).getPropertyValue(t).trim())
```
Expected: `[]` (array vazio — nenhum token órfão)

- [ ] **Step 4: Commit**

```bash
git add css/tokens.css css/style.css
git commit -m "refactor(css): extrai tokens e adiciona escalas de tipo e espaço"
```

---

### Task 4: Aba "Hoje"

**Files:**
- Create: `js/sections/today.js`
- Modify: `index.html` (novo painel `#tab-today`, nova tag `<script>`)

**Interfaces:**
- Consumes: `window.Muscles.recencyByGroup`, `window.Prescribe.suggest`, `window.Streak.render`, `window.State.App`, `window.UI.openSessionModal`
- Produces: `window.Today.render()` — desenha o painel inteiro a partir de `App.rawSessions` e `App.sessions`.

- [ ] **Step 1: Marcar o HTML**

Em `index.html`, dentro de `<main id="main">`, **antes** do painel `tab-overview`, inserir:

```html
    <section class="tab-panel" data-tab="today" id="tab-today" role="tabpanel" aria-labelledby="tab-today-btn">
      <section class="today-groups">
        <h2>O que está atrasado</h2>
        <div id="muscleGrid" class="muscle-grid"></div>
      </section>
      <section class="today-next">
        <h2 id="nextLoadTitle">Próxima carga</h2>
        <p class="chart-note" id="nextLoadRule"></p>
        <div id="nextLoadList" class="next-load"></div>
      </section>
    </section>
```

E adicionar a tag de script antes de `js/render.js`:

```html
  <script defer src="js/muscles.js"></script>
  <script defer src="js/prescribe.js"></script>
  <script defer src="js/sections/today.js"></script>
```

- [ ] **Step 2: Implementar a seção**

Criar `js/sections/today.js`:

```js
/**
 * js/sections/today.js — Aba "Hoje"
 *
 * Namespace: window.Today
 *
 * Superfície prescritiva: responde "o que treinar" e "que carga", nesta ordem.
 * Ignora o filtro de período de propósito — o filtro é um controle analítico, e
 * "que grupo está atrasado" não muda conforme a janela que você escolheu olhar.
 *
 * Dependências: State, UI, Muscles, Prescribe
 */
window.Today = (function () {
  const { App } = window.State;
  let grupoSelecionado = null;

  /** Quanto tempo faz, em português curto. */
  function haQuantoTempo(dias) {
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'ontem';
    if (dias < 30) return `há ${dias} dias`;
    if (dias < 365) return `há ${Math.round(dias / 30)} meses`;
    return dias < 550 ? 'há 1 ano' : `há ${Math.round(dias / 365)} anos`;
  }

  /** Faixa de atraso → nível 0-3, para a carga visual ficar no atraso. */
  function nivelAtraso(dias) {
    if (dias <= 4) return 0;
    if (dias <= 10) return 1;
    if (dias <= 30) return 2;
    return 3;
  }

  function renderGrupos(grupos) {
    const grid = document.getElementById('muscleGrid');
    if (!grid) return;
    if (!grupos.length) {
      grid.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'modal-hint', textContent: 'Nenhum treino registrado ainda.',
      }));
      return;
    }
    const frag = document.createDocumentFragment();
    for (const g of grupos) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'muscle-card';
      btn.dataset.level = String(nivelAtraso(g.daysSince));
      btn.setAttribute('aria-pressed', String(g.group === grupoSelecionado));
      btn.classList.toggle('active', g.group === grupoSelecionado);

      const nome = document.createElement('span');
      nome.className = 'muscle-name';
      nome.textContent = g.group;

      const quando = document.createElement('span');
      quando.className = 'muscle-since';
      quando.textContent = haQuantoTempo(g.daysSince);

      btn.append(nome, quando);
      btn.addEventListener('click', () => {
        grupoSelecionado = g.group;
        render();
      });
      frag.append(btn);
    }
    grid.replaceChildren(frag);
  }

  function renderProximaCarga(grupos) {
    const lista = document.getElementById('nextLoadList');
    const titulo = document.getElementById('nextLoadTitle');
    const regra = document.getElementById('nextLoadRule');
    if (!lista) return;

    const grupo = grupos.find(g => g.group === grupoSelecionado);
    if (!grupo) {
      if (titulo) titulo.textContent = 'Próxima carga';
      if (regra) regra.textContent = '';
      lista.replaceChildren(Object.assign(document.createElement('p'), {
        className: 'modal-hint',
        textContent: 'Escolha um grupo acima para ver a carga sugerida de cada exercício.',
      }));
      return;
    }

    if (titulo) titulo.textContent = `Próxima carga · ${grupo.group}`;
    // A regra fica visível na interface. Sugestão de carga sem regra à vista é
    // palpite com cara de autoridade.
    if (regra) {
      regra.textContent = 'Bateu o topo da faixa de repetições em todas as séries, sobe a carga; '
        + 'não bateu, mantém e busca uma repetição a mais. O incremento é o menor que você já usou naquele exercício.';
    }

    const frag = document.createDocumentFragment();
    for (const nome of grupo.exercises) {
      const s = window.Prescribe.suggest(App.rawSessions, nome, new Date());
      if (!s) continue;

      const linha = document.createElement('div');
      linha.className = 'load-row';
      linha.dataset.status = s.status;

      const exNome = document.createElement('div');
      exNome.className = 'load-name';
      exNome.textContent = nome;

      // O feito sempre ao lado do sugerido, nunca a sugestão sozinha.
      const feito = document.createElement('div');
      feito.className = 'load-done';
      feito.textContent = `${s.lastReps}×${s.lastWeight} kg · ${haQuantoTempo(s.daysSince)}`;

      const sugerido = document.createElement('div');
      sugerido.className = 'load-next';
      if (s.status === 'stale') {
        sugerido.textContent = 'sem sugestão — parado há muito tempo';
        sugerido.classList.add('is-muted');
      } else {
        sugerido.textContent = `${s.targetReps}×${s.suggestedWeight} kg`;
      }

      linha.append(exNome, feito, sugerido);
      frag.append(linha);
    }

    lista.replaceChildren(frag.childNodes.length ? frag : Object.assign(
      document.createElement('p'),
      { className: 'modal-hint', textContent: 'Sem histórico de carga neste grupo.' },
    ));
  }

  function render() {
    const grupos = window.Muscles.recencyByGroup(App.rawSessions, new Date());
    renderGrupos(grupos);
    renderProximaCarga(grupos);
  }

  return { render };
})();
```

- [ ] **Step 3: Ligar no ciclo de render**

Em `js/render.js`, dentro de `rerender()`, adicionar como primeira linha do corpo:

```js
    window.Today?.render();
```

- [ ] **Step 4: Estilo dos componentes novos**

Acrescentar ao fim de `css/style.css`:

```css
/* Hoje ------------------------------------------------------------------- */
.today-groups { margin-bottom: var(--space-8); }
.today-groups h2, .today-next h2 {
  margin: 0 0 var(--space-4);
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.muscle-grid {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
}
/* A carga visual fica no ATRASO, não no volume: quanto mais tempo sem treinar,
   mais forte o card. É o que a tela precisa responder. */
.muscle-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color var(--transition), background var(--transition);
}
.muscle-card[data-level="1"] { border-color: rgba(239, 61, 87, 0.18); }
.muscle-card[data-level="2"] { border-color: rgba(239, 61, 87, 0.34); background: rgba(239, 61, 87, 0.05); }
.muscle-card[data-level="3"] { border-color: var(--accent); background: rgba(239, 61, 87, 0.1); }
.muscle-card:hover { background: var(--surface-raised); }
.muscle-card.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.muscle-name { color: var(--text); font-size: var(--text-base); font-weight: 650; }
.muscle-since { color: var(--muted); font-size: var(--text-xs); }

.next-load { display: flex; flex-direction: column; gap: var(--space-1); }
.load-row {
  display: grid;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-soft);
  grid-template-columns: minmax(0, 1fr) auto auto;
}
.load-name { color: var(--text); font-size: var(--text-base); font-weight: 620; }
.load-done { color: var(--muted); font-size: var(--text-sm); font-variant-numeric: tabular-nums; }
.load-next {
  color: var(--text);
  font-size: var(--text-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.load-row[data-status="raise"] .load-next { color: var(--status-good); }
.load-next.is-muted { color: var(--muted); font-size: var(--text-sm); font-weight: 500; }

@media (max-width: 620px) {
  .load-row { grid-template-columns: minmax(0, 1fr) auto; }
  .load-done { grid-column: 1 / -1; }
}
```

- [ ] **Step 5: Verificar no browser**

Abrir `http://localhost:8000/?tab=today`.
Expected: grade de 14 grupos ordenada do mais atrasado; clicar num grupo preenche "Próxima carga" com uma linha por exercício, cada uma mostrando o que foi feito **e** a sugestão; nenhum erro de console.

- [ ] **Step 6: Commit**

```bash
git add index.html js/sections/today.js js/render.js css/style.css
git commit -m "feat(today): aba Hoje com grupos por recência e próxima carga"
```

---

### Task 5: Fundir as quatro abas em duas

**Files:**
- Modify: `index.html`, `js/state.js`, `js/tabs.js`, `css/style.css`

**Interfaces:**
- Consumes: `window.Today.render()` da Task 4
- Produces: abas `today` e `evolution`; `parseTabFromURL()` aceita só esses dois valores e mapeia os antigos.

- [ ] **Step 1: Trocar a navegação**

Em `index.html`, substituir o `<nav class="tabs-nav">` inteiro por:

```html
    <nav class="tabs-nav" role="tablist" aria-label="Seções do painel">
      <button data-tab="today" id="tab-today-btn" class="active" role="tab" aria-selected="true" aria-controls="tab-today" tabindex="0">Hoje</button>
      <button data-tab="evolution" id="tab-evolution-btn" role="tab" aria-selected="false" aria-controls="tab-evolution" tabindex="-1">Evolução</button>
    </nav>
```

- [ ] **Step 2: Unificar os painéis analíticos**

Em `index.html`, envolver os quatro painéis existentes (`tab-overview`, `tab-strength`, `tab-consistency`, `tab-history`) num único painel, removendo os `class="tab-panel"` e `hidden` de cada um e trocando por `class="evo-section"`:

```html
    <section class="tab-panel" data-tab="evolution" hidden id="tab-evolution" role="tabpanel" aria-labelledby="tab-evolution-btn">
      <div class="evo-nav">
        <a href="#tab-overview">Visão geral</a>
        <a href="#tab-strength">Força</a>
        <a href="#tab-consistency">Consistência</a>
        <a href="#tab-history">Histórico</a>
      </div>

      <section class="evo-section" id="tab-overview"> … conteúdo atual … </section>
      <section class="evo-section" id="tab-strength"> … conteúdo atual … </section>
      <section class="evo-section" id="tab-consistency"> … conteúdo atual … </section>
      <section class="evo-section" id="tab-history"> … conteúdo atual … </section>
    </section>
```

**Os `id` originais são mantidos e as âncoras apontam para eles.** Um elemento não
pode ter dois ids, e `lazyChart` procura os painéis por `tab-overview`,
`tab-strength` e `tab-history` — renomear para `evo-*` faria os gráficos pararem
de ser criados. Muda só a tag: de `class="tab-panel" hidden` para
`class="evo-section"`, sem `hidden` (agora todos ficam visíveis, rolando).

Como os quatro deixam de ser `.tab-panel`, o `Tabs.switchTo` passa a controlar
apenas `#tab-today` e `#tab-evolution` — exatamente o que se quer.

- [ ] **Step 3: Mover o seletor de período**

Em `index.html`, tirar `<div class="hero-period" id="rangePickerHost"></div>` da hero e pôr dentro de `#tab-evolution`, logo depois de `.evo-nav`. O filtro é analítico: "Hoje" ignora janela por definição.

- [ ] **Step 4: Atualizar o parser de aba**

Em `js/state.js`, substituir `parseTabFromURL`:

```js
  function parseTabFromURL() {
    const tab = new URLSearchParams(location.search).get('tab');
    // Os nomes antigos viram 'evolution' para não quebrar links salvos.
    const antigos = { overview: 'evolution', strength: 'evolution', consistency: 'evolution', history: 'evolution' };
    if (tab === 'today' || tab === 'evolution') return tab;
    return antigos[tab] ?? 'today';
  }
```

E em `syncTabToURL`, trocar `if (name === 'overview')` por `if (name === 'today')`.

- [ ] **Step 5: Estilo da navegação por âncoras**

Acrescentar a `css/style.css`:

```css
.evo-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}
.evo-nav a {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted-strong);
  font-size: var(--text-sm);
  font-weight: 620;
  text-decoration: none;
}
.evo-nav a:hover { border-color: var(--accent-border); background: var(--accent-soft); color: var(--text); }
.evo-section { scroll-margin-top: var(--space-10); margin-bottom: var(--space-10); }
```

- [ ] **Step 6: Verificar**

Run: `npm test`
Expected: 135 passando

Abrir no browser e conferir: as duas abas alternam; `?tab=strength` (link antigo) cai em "Evolução"; os gráficos das seções `tab-overview`/`tab-strength`/`tab-history` continuam sendo criados; sem erro de console.

- [ ] **Step 7: Commit**

```bash
git add index.html js/state.js js/tabs.js css/style.css
git commit -m "refactor(ia): duas abas nomeadas pelo momento de uso"
```

---

### Task 6: Dividir o CSS por responsabilidade

**Files:**
- Create: `css/base.css`, `css/components.css`, `css/sections.css`
- Modify: `css/style.css` (vira só a lista de imports)

**Interfaces:**
- Produces: `css/style.css` contendo apenas `@import`, na ordem tokens → base → components → sections.

- [ ] **Step 1: Cortar o arquivo**

Mover os blocos de `css/style.css`, sem alterar nenhuma regra:

- `base.css` — reset (`*`, `html`, `body`), `.skip-link`, `.wrap`, scrollbars, foco, `@media print`, `prefers-reduced-motion`, `prefers-contrast`
- `components.css` — `.kpi`, `.chart-box`, `.table-toggle`, `.chart-table`, tabelas, `.session-card`, `.pr-*`, `.modal-*`, `.toast*`, `.empty-state`, `.streak*`, `.muscle-*`, `.load-*`
- `sections.css` — `.hero*`, `.tabs-nav`, `.evo-*`, `.today-*`, `.heatmap`, `.heat-*`, `.comparison-select`, `.kpis`, `.chart-row`, e todos os `@media` de layout

- [ ] **Step 2: `style.css` vira o índice**

```css
/* ==========================================================================
   Gym Dashboard — folha de estilo
   Ordem importa: tokens primeiro, depois base, componentes e seções.
   ========================================================================== */
@import url("tokens.css");
@import url("base.css");
@import url("components.css");
@import url("sections.css");
```

- [ ] **Step 3: Verificar que o visual não mudou**

Abrir as duas abas em desktop (1440px) e mobile (390px).
Expected: pixel-equivalente ao anterior; sem 404 na aba Network; sem token órfão (mesmo snippet da Task 3, Step 3).

- [ ] **Step 4: Commit**

```bash
git add css/
git commit -m "refactor(css): divide style.css por responsabilidade"
```

---

### Task 7: Passe de densidade e verificação final

**Files:**
- Modify: `css/sections.css`, `css/components.css`

**Interfaces:**
- Consumes: tokens da Task 3

- [ ] **Step 1: Diferenciar a densidade das duas superfícies**

Em `css/sections.css`, acrescentar:

```css
/* "Hoje" é decisão em segundos: arejado e grande.
   "Evolução" é exploração: denso e compacto. Densidade igual nas duas apaga
   a diferença de uso que a IA acabou de criar. */
#tab-today { font-size: 1.02rem; }
#tab-today .muscle-card { padding: var(--space-4) var(--space-4); }
#tab-today .load-row { padding: var(--space-4); }

#tab-evolution .chart-box { padding: var(--space-4); }
#tab-evolution .kpi { padding: var(--space-4); }
```

- [ ] **Step 2: Substituir os espaçamentos avulsos restantes**

Procurar e trocar pelos tokens mais próximos:

Run: `grep -nE "(padding|margin|gap):[^;]*(13px|17px|19px|21px|18px|14px|11px)" css/*.css`
Expected: cada ocorrência trocada por `var(--space-N)`. Um `grep` novo depois deve voltar vazio para esses valores.

- [ ] **Step 3: Suíte completa**

Run: `npm test`
Expected: 135 passando, 0 falhando

Run: `npm run validate`
Expected: `✓ 140 sessões, … — schema OK.`

- [ ] **Step 4: Verificação em browser real**

Com o servidor no ar, para cada viewport (1440×1000 e 390×844) e cada aba:

```js
JSON.stringify({
  erros: 'ver console',
  overflow: document.documentElement.scrollWidth > innerWidth,
  charts: Object.keys(window.State.App.charts).filter(k => !k.startsWith('pr-spark')),
  gruposHoje: document.querySelectorAll('.muscle-card').length,
})
```
Expected: `overflow: false`, zero erros de console, `gruposHoje: 14`, e os gráficos criados ao entrar em "Evolução".

- [ ] **Step 5: Commit**

```bash
git add css/
git commit -m "style: densidade por superfície e espaçamento em tokens"
```

---

## Verificação de cobertura do spec

| Requisito do spec | Task |
|---|---|
| Duas abas nomeadas pelo momento de uso | 5 |
| Tira de 12 semanas em "Hoje" | já existe; movida na 5 |
| Mapa de grupos por recência | 1, 4 |
| Próxima carga com regra visível | 2, 4 |
| Regra: topo da faixa → sobe; senão mantém | 2 |
| Incremento do histórico do próprio exercício | 2 |
| Faixa padrão 8–12 | 2 |
| Sem histórico → não sugere | 2 |
| Lacuna > 180 dias → sem sugestão | 2 |
| Sugestão sempre ao lado do feito | 4 |
| Seletor de período sai da hero para "Evolução" | 5 |
| "Evolução" com âncoras, nada removido | 5 |
| Escala de tipo em tokens | 3 |
| Escala de espaço em tokens | 3, 7 |
| Densidade por superfície | 7 |
| `style.css` dividido em quatro | 6 |
| Paleta não muda | Global Constraints |
| Testes das funções puras | 1, 2 |
| 117 testes atuais seguem passando | 1, 2, 5, 7 |
| Verificação em browser, desktop e mobile | 4, 6, 7 |
