# 💪 Evolução na Academia — Gym Dashboard

Dashboard pessoal vanilla-JS + Chart.js para visualizar sessões de treino
exportadas do GymBook/Strong, com métricas determinísticas, filtros por URL
e visual mobile-first.

**Deploy:** https://gym-dashboard-brown-tau.vercel.app

## Stack

- **HTML + CSS + JS vanilla** — sem build, sem framework, sem `node_modules`
- **Chart.js 4.4.7** carregado via CDN (`cdn.jsdelivr.net`)
- **html2canvas 1.4.1** para export PNG
- **`node --test`** nativo para testes unitários (zero deps externas)
- **4 JSONs** ativos do app GymBook/Strong (ver [`data/SCHEMAS.md`](data/SCHEMAS.md))

## Como rodar

O `fetch()` falha quando aberto direto via `file://`. Use um servidor estático local:

```bash
npm start
# ou:
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

> **Fallback**: se o `fetch()` falhar (ex.: ainda em `file://`), o dashboard
> carrega um JSON embutido e oferece drag-and-drop para você arrastar
> `data/WorkoutSession.json` manualmente.

## Comandos

| Comando             | O que faz                                        |
|---------------------|--------------------------------------------------|
| `npm start`         | sobe servidor estático em `:8000`                |
| `npm test`          | roda testes unitários (98 testes, 0 deps)        |
| `npm run validate`  | valida schema dos JSONs em `data/`               |

## Estrutura

```
gym-dashboard/
├── index.html                # shell HTML semântico (lang, viewport-fit, aria)
├── css/
│   └── styles.css            # design system premium
├── js/
│   ├── i18n.js               # strings PT-BR centralizadas
│   ├── state.js              # App global + URL + localStorage
│   ├── data.js               # funções puras (normalize, PRs, delta, streak)
│   ├── ui.js                 # primitivas DOM-safe (kpiCard, modal)
│   ├── charts.js             # pool Chart.js (lazy via IntersectionObserver)
│   ├── sections/
│   │   ├── overview.js       # KPIs + Adherence (aba "overview")
│   │   ├── strength.js       # charts de Volume/1RM/Weekday + tabela (aba "strength")
│   │   └── consistency.js    # heatmap diário + cards de PRs (aba "consistency")
│   ├── render.js             # shims para sections/ + hero, range picker, RPE,
│   │                         # coach, measurements, comparison, rerender
│   ├── tabs.js               # navegação por abas (URL sincronizada)
│   ├── summary.js            # resumo textual determinístico
│   ├── rpe.js                # scatter RPE×%1RM (estado vazio se dados faltarem)
│   ├── coach.js              # aderência semanal
│   ├── measurements.js       # timeline de medidas corporais
│   ├── export.js             # PNG + share URL
│   ├── drop.js               # fallback drag-and-drop file://
│   └── main.js               # entry point
├── data/
│   ├── WorkoutSession.json   # ← consumido (140 sessões)
│   ├── Measurement.json      # ← consumido (catálogo)
│   ├── MeasurementLog.json   # ← vazio (exibe estado vazio)
│   ├── WorkoutSessionSet.json # ← consumido para RPE (sem date/exercise)
│   ├── CoachWorkout.json     # ← consumido parcialmente (aderência)
│   └── SCHEMAS.md            # schema de cada arquivo + lista de órfãos
├── tests/                    # node --test (98 testes, 26 suítes)
│   ├── pure-fns.test.js      # data.js + bordas
│   ├── aggregate.test.js     # dados reais + schema
│   └── state.test.js         # state.js + URL/localStorage
├── scripts/validate-data.js  # validador de schema
├── .github/workflows/ci.yml  # CI: Node 18 + 20, ubuntu
├── .editorconfig             # indentação 2 espaços, LF
├── vercel.json               # cache headers + security headers
├── package.json              # scripts npm
├── CHANGELOG.md              # histórico de mudanças
├── LICENSE                   # MIT
└── README.md
```

## Arquitetura de módulos

Cada arquivo em `js/` expõe um namespace global em `window`. A ordem de
carregamento em `index.html` reflete as dependências: primeiro os
módulos sem dependência (`i18n`, `state`, `data`, `ui`, `charts`), depois
as seções, depois o `render.js` que atua como shim, e por fim os
auxiliares (`rpe`, `coach`, `measurements`, etc.) que dependem de
`App` populado.

### Padrão shim

`render.js` mantém a API pública original (`window.Render.renderKPIs`,
etc.) mas delega para módulos em `js/sections/`. Isso permite extrair
seções sem quebrar call sites externos e mantém a possibilidade de
reverter cada extração de forma independente.

Exemplo:

```js
// js/render.js
function renderKPIs(sessions) {
  return window.Overview.renderKPIs(sessions);
}

// js/sections/overview.js
window.Overview = (function () {
  function renderKPIs(sessions) { /* ... */ }
  return { renderKPIs };
})();
```

### Namespaces

| Namespace      | Responsabilidade                                |
|----------------|-------------------------------------------------|
| `Data`         | funções puras (sem DOM): normalize, PRs, delta  |
| `State`        | estado global + URL + localStorage              |
| `UI`           | primitivas DOM-safe (kpiCard, modal, etc.)      |
| `Charts`       | pool Chart.js com lazy loading                  |
| `I18N`         | strings PT-BR                                   |
| `Render`       | shims + hero/range/RPE/coach/measurements       |
| `Overview`     | KPIs + Adherence (aba "overview")               |
| `Strength`     | Volume/1RM/Weekday charts + tabela (aba "strength") |
| `Consistency`  | Heatmap + PRs (aba "consistency")               |
| `Tabs`         | navegação por abas                              |
| `Summary`      | resumo textual determinístico                   |
| `RPE`          | scatter RPE×%1RM                                |
| `Coach`        | aderência semanal                               |
| `Measurements` | timeline de medidas corporais                   |
| `Export`       | PNG + share URL                                 |
| `Drop`         | fallback drag-and-drop file://                  |
| `Main`         | entry point                                     |

## Filtros por URL

Todos os filtros refletem na URL — pode compartilhar/colar/linkar.

| Param                                       | Exemplo                                            | Resultado                       |
|---------------------------------------------|----------------------------------------------------|---------------------------------|
| `?days=N`                                   | `?days=181` (default do app)                       | últimos N dias a partir de hoje |
| `?from=YYYY-MM-DD`                          | `?from=2026-01-01`                                 | início explícito                |
| `?to=YYYY-MM-DD`                            | `?to=2026-06-30`                                   | fim explícito                   |
| `?from=&to=`                                | `?from=2026-01-01&to=2026-06-30`                   | período custom                  |
| `?tab=overview\|strength\|consistency\|history` | `?tab=strength`                                 | abre aba específica             |

Filtros e aba ativa são preservados em `localStorage` (chave `gym-dashboard`).

## Cálculos determinísticos

- **Volume** = Σ `(weight × reps)` apenas para sets `isComplete: true`.
- **1RM** = `set.oneRepMax` do JSON quando válido; senão **Epley**:
  `weight × (1 + reps / 30)`.
- **Recordes (PRs)** = maior 1RM histórico por exercício, com data do PR.
- **Δ período** = compara período atual vs imediatamente anterior
  (mesma duração). Retorna `null` quando não há base (previous=0) — UI
  mostra "Sem base comparativa" em vez de "= 0%".
- **Aderência semanal** = agrupa por **segunda-feira UTC** (ISO week).
  Meta configurável (`App.weeklyGoal`, default 4). Distingue semana
  **concluída** de **em andamento**: a semana corrente só conta no
  streak atual se já bateu meta.
- **Heatmap diário** = sessões por dia, escala de 5 níveis.
- **RPE scatter** = `(weight / oneRepMax) × 100` × RPE estimado por
  `reps/maxReps`. **Importante**: `WorkoutSessionSet.json` no app
  exportado não tem `date`/`exerciseName`, então a aba exibe estado
  vazio elegante. Se o JSON for re-exportado com essas chaves, o
  gráfico aparece automaticamente sem mudança de código.

### Por que UTC?

Datas em `startDate` são ISO 8601 com `Z`. Para evitar que o usuário no
Brasil veja o treino de 22h UTC como "amanhã" (fuso BRT = UTC−3), todo
filtro e cálculo de semana usa UTC. `startOfWeekUTC(date)` retorna
segunda-feira UTC; `isoDayUTC(date)` retorna `YYYY-MM-DD` UTC.

## Origem dos dados

- **WorkoutSession.json** — exportado do app GymBook/Strong, contém
  140 sessões completas com séries, pesos, 1RM estimado pelo app.
- **Measurement.json** — catálogo (Weight, Body Fat %, etc.). Logs
  (`MeasurementLog.json`) ainda vazios no export.
- **CoachWorkout.json** — schema raso (`{id, workout:{...}}`), apenas
  para aderência semanal.

Veja [`data/SCHEMAS.md`](data/SCHEMAS.md) para detalhes de cada campo
consumido vs órfão.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel --prod
```

Configuração em [`vercel.json`](vercel.json): cache headers
(`data/*` 1h, `js/*` 5min), security headers
(`X-Content-Type-Options`, `Referrer-Policy`).

## Limitações

- **Sem backend**: tudo roda client-side. Os JSONs são estáticos e
  commitados junto do app.
- **Sem persistência de treino**: dashboard é somente leitura dos
  exports.
- **Medições corporais**: o export do app não traz logs; estado vazio
  elegante é exibido.
- **RPE**: dependente do JSON de sets trazer `date`/`exerciseName` (não
  exportado pelo app atualmente).

## Privacidade

- **Nenhum dado sai do browser**. Sem analytics, telemetria, Sentry,
  cookies de terceiros.
- **Clipboard**: botão "🔗" copia URL atual (filtros + aba) para a área
  de transferência. Requer HTTPS ou localhost.
- **localStorage**: salva filtros e aba ativa para restaurar ao recarregar.

## Métricas & fórmulas (TL;DR)

| Métrica          | Fórmula                                            |
|------------------|----------------------------------------------------|
| Volume (sessão)  | Σ `weight × reps` para `isComplete: true`          |
| 1RM estimado     | `weight × (1 + reps / 30)` (Epley)                 |
| PR por exercício | max(1RM histórico) + data do PR                     |
| Streak semanal   | semanas anteriores concluídas com `n ≥ meta`       |
| Δ período        | `(atual - anterior) / anterior × 100` arredondado   |
| Volume relativo  | `weight / 1RM × 100`                               |

## Licença

[MIT](LICENSE) — uso pessoal. Os JSONs do app GymBook são de propriedade do usuário.