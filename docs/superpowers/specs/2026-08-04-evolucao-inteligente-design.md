# Dashboard Evolução Inteligente — Design Spec

**Data:** 2026-08-04
**Status:** Aprovado pelo usuário
**Projeto:** `/home/william/gym-dashboard`

## Context

O gym-dashboard pessoal está visualmente coerente mas é um **relatório técnico empilhado**, não uma central inteligente de evolução. Mostra números sem contexto, sem interpretação, sem direção. Mistura PT-BR e inglês, depende de sequência diária (métrica ruim para musculação), e exige rolagem vertical longa.

Esta spec transforma o dashboard em uma ferramenta pessoal que **responde perguntas** em vez de exigir que o usuário interprete gráficos sozinho.

## Goals

1. **Resposta imediata** — primeira tela mostra "está evoluindo?", comparação vs período anterior, status geral
2. **Tradução PT-BR total** — remover inconsistências (Personal Records, Streak, Dashboard)
3. **Métricas inteligentes** — substituir sequência diária por aderência semanal; PRs viram informação acionável
4. **Layout com abas** — reduzir rolagem vertical excessiva
5. **Mobile corrigido** — tabela → cards em telas pequenas

## Non-Goals

- Reescrever em framework (mantém vanilla JS)
- Adicionar dependências novas (Chart.js já é a única)
- Modularizar (Fase 2 do roadmap existente — fora de escopo)
- Backend / persistência remota

## Decisões de design

| Decisão | Escolha | Razão |
|---|---|---|
| Escopo | P0 + P1 + P2 completos | Usuário aprovou "fazer tudo" |
| Estrutura JS | Reusar módulos atuais | Usuário escolheu; menos risco |
| Streak diário | Substituir por aderência semanal | Sequência diária transforma descanso correto em fracasso |
| Idioma | PT-BR total | Usuário escolheu |
| Mobile | Tabela → cards < 768px | Tabela de 5 colunas quebra |
| Commit | Sim, no final | Usuário aprovou |

## Arquitetura

Mantém módulos atuais: `js/{state,data,charts,ui,render,drop,main}.js`. Adiciona:

- `js/summary.js` — geração de resumo textual automático
- `js/i18n.js` — centralizar strings PT-BR
- `js/tabs.js` — controller de navegação por abas
- CSS em `index.html` para: abas, badges, mobile cards, deltas de KPI

## Estrutura por aba

### Aba "Visão Geral"
- Hero compacto: "Evolução de William" + último treino + atualizado em + filtro período
- Resumo automático (1-2 frases)
- 4 KPIs com delta: Treinos, Volume, Frequência Semanal, Novos Recordes
- 2 charts lado a lado: Volume Mensal + Evolução de Força (1RM top-3)
- Aderência Semanal: card meta + heatmap

### Aba "Força"
- Top 10 PRs com sparkline (mantém atual)
- PRs classificados: novos, em evolução, estagnados
- Comparador de exercícios (futuro — fora de escopo desta spec)

### Aba "Consistência"
- Heatmap anual (GitHub-style)
- Aderência semanal detalhada
- Alertas: grupo negligenciado, queda frequência

### Aba "Histórico"
- Tabela (desktop) / cards (mobile)
- Drill-down em sessão: modal com exercícios, séries, reps

## Componentes novos

### `kpiCard(value, label, delta?)` (js/ui.js)
- Aceita `delta` opcional `{ pct, direction }`
- Renderiza `↑ 14%` / `↓ 8%` em cor semântica

### `computePeriodDelta(sessions, range)` (js/data.js)
- Reutilizável por KPIs e charts
- Retorna `{ current, previous, deltaPct }`

### `renderSummary(sessions)` (js/summary.js)
- Gera texto comparando volume + frequência vs período anterior
- Ex: "Volume subiu 12%, mas frequência caiu de 4,5 para 3,8 semanais."

### `computeWeeklyAdherence(sessions, goal=4)` (js/data.js)
- Conta semanas ISO com ≥ goal treinos
- Retorna `{ currentStreak, longestStreak, totalWeeks, weeksHit }`

### `classifyPRs(prs)` (js/data.js)
- Categoriza em: `novo` (≤ 30 dias), `evolucao` (≤ 60 dias), `estagnado` (> 60 dias)

## Mudanças críticas

### `index.html`
- Adicionar barra de navegação por abas (`<nav class="tabs">`)
- Reorganizar `<section>` em containers com `data-tab="overview|forca|consistencia|historico"`
- Hero compacto (sem eyebrow genérico, sem subtítulo longo)
- CSS: tabs, badges, deltas, mobile cards

### `js/state.js`
- Adicionar `App.tab = 'overview'`
- `App.loadedAt = new Date()` (populado em main.js após fetch)

### `js/data.js`
- `computePeriodDelta(sessions, range, field, agg='sum')`
- `computeWeeklyAdherence(sessions, goal)`
- Manter `computeStreak()` deprecated mas não usar

### `js/ui.js`
- `kpiCard(value, label, delta?)` — suportar delta
- `summaryCard(text)` — renderiza resumo automático
- `prBadge(status)` — badge classificado
- `sessionCard(session)` — card mobile

### `js/summary.js` (novo)
- `renderSummary(sessions, range)` — texto contextual

### `js/tabs.js` (novo)
- `initTabs()` — event listeners
- `switchTab(name)` — mostra/esconde containers

### `js/render.js`
- `renderKPIs` com delta usando `computePeriodDelta`
- `renderPRs` com classificação `novo|evolucao|estagnado`
- `renderAdherence` substitui `renderStreak`
- `renderSessions` — branch mobile vs desktop
- `renderSummary` chama `summary.js`

### `js/i18n.js` (novo)
- Objeto `I18N` com todas as strings
- `t(key)` lookup

### `js/main.js`
- Popula `App.loadedAt = new Date()` após fetch
- Chama `initTabs()`
- Atualiza header "Atualizado HH:mm"

## Critérios de aceitação

1. **P0 — Comparação visível**: cada KPI mostra `↑/↓ % vs período anterior`
2. **P0 — Resumo automático**: parágrafo 1-2 frases aparece acima dos KPIs
3. **P0 — Hero compacto**: header cabe em 1 linha em desktop
4. **P0 — PT-BR total**: zero string em inglês na UI (exceto nome técnico inevitável)
5. **P0 — Mobile**: tabela vira cards em < 768px
6. **P0 — Loading + última atualização**: spinner + timestamp visíveis
7. **P1 — Abas funcionais**: clicar muda container, sem reload
8. **P1 — Streak → aderência**: card mostra "X semanas com ≥4 treinos"
9. **P1 — PRs classificados**: 3 grupos visíveis com cores distintas
10. **P1 — Drill-down**: clicar sessão abre modal

## Verification (end-to-end)

1. Servidor local: `cd /home/william/gym-dashboard && python3 -m http.server 8000`
2. Abrir `http://localhost:8000` em desktop
3. Verificar: hero compacto, 4 KPIs com delta, resumo textual, abas funcionais
4. Trocar período (30d/90d) — KPIs recalculam
5. Resize para 375px — tabela vira cards
6. Inspecionar console — zero string em inglês visível
7. Clicar sessão — modal abre com exercícios
8. `git add -A && git commit -m "feat: dashboard inteligente"` + push

## Riscos

- **Renderização**: Chart.js recria em mudança de aba — usar pool (Fase 1 roadmap)
- **Performance**: re-render em troca de aba dispara tudo — memoizar via `App.range`
- **Mobile**: cards precisam de breakpoint claro (768px)
- **Push**: repo GitHub pode ter remote diferente — verificar antes