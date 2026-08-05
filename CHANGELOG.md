# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

### Adicionado
- `LICENSE` (MIT).
- `CHANGELOG.md` (este arquivo).
- `.editorconfig` — indentação 2 espaços, trim trailing whitespace, LF.
- `js/sections/overview.js` — extração de `renderKPIs` + `renderAdherence` de `js/render.js` em módulo dedicado (padrão shim para preservar API pública).
- `js/sections/strength.js` — extração de `renderVolumeChart`, `renderOneRmChart`, `renderWeekdayChart`, `renderSessionsTable`. `js/render.js` foi de 708 → 497 linhas.
- `js/sections/consistency.js` — extração de `renderHeatmap` e `renderPRs`. `js/render.js` foi de 497 → 362 linhas.
- `.github/workflows/ci.yml` — CI rodando `npm test` + `npm run validate` em Node 18 e 20 (Ubuntu).
- Cobertura de testes de borda em `js/data.js`: `computeVolume`, `startOfWeekUTC` (virada de ano ISO), `applyRangeFilter` (com vs sem bound), `normalizeSession` (startDate/restTime ausentes), `computePRs` (date/name inválidos, empate, `oneRm=0`), `computePeriodDelta` (agg=avg), `computeWeeklyAdherence` (`inProgressWeek`, `longestStreak > 1`).
- `tests/state.test.js` — cobertura de `state.js` (URL, localStorage, persistência, bordas).
- `tests/ui.test.js` — cobertura de `ui.js` (kpiCard, prBadge, prCard, escapeHtml, spanText, summaryCard) com mock DOM mínimo (~25 linhas, sem jsdom).
- `docs/nexus-hazel-investigation.md` — relatório técnico de investigação do domínio `nexus-public-hazel.vercel.app` (descobriu-se tratar de projeto separado chamado "Nexus", não o gym-dashboard).
- **Fase 1 do refactor visual:**
  - `index.html` — `<p class="hero-subtitle">` substitui o subtítulo gerado via `h1::after`. ARIA das abas: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-controls`, `aria-labelledby` em todas as 4 abas e painéis.
  - `css/styles.css` — `.skip-link` com `transform: translateY(-160%)` e `:focus` restaurando. `.hero-subtitle` real. `--c-accent`/`--c-positive`/`--c-strength`/`--c-warning`/`--c-previous` no `:root`. Range-picker mobile vira scroll horizontal rolável (`overflow-x: auto`, `scroll-snap-type`, `min-width: 84px`, `min-height: 44px`). `.chart-canvas-wrap` (320px desktop, 250px mobile) com canvas absoluto. `.kpi .sub` (info secundária). `.comparison-select label` agora `min-height: 44px`. `.range-picker button` desktop também 44px.
  - `js/render.js` — `window.CHART_COLORS` (Object.freeze) e `window.SERIES_PALETTE` exportados. Paletas hardcoded em `renderRPEChart`, `renderMeasurementsChart`, `renderComparisonChart` substituídas por `SERIES_PALETTE`.
  - `js/sections/strength.js`, `js/sections/consistency.js` — cores hardcoded substituídas por `window.CHART_COLORS.*`.
  - `js/tabs.js` — navegação por teclado: `ArrowLeft`/`ArrowRight`/`Home`/`End` com `preventDefault`, focus + `switchTo`. Roving tabindex já era feito.
  - `js/ui.js` — `kpiCard(value, label, delta, sub)` com 4º argumento opcional `{text, tone}` (tone: muted/up/down).
  - `js/sections/overview.js` — KPI "Novos Recordes" agora passa `sub` com data do PR mais recente (`tone: 'up'`) ou fallback "Conquistados no período".
  - `js/i18n.js` — chave `kpi.sub.newPRs`.

### Mudado
- `index.html` — adicionado `<script defer src="js/sections/overview.js">` antes de `js/render.js`.
- `js/render.js` — `renderKPIs` e `renderAdherence` agora são shims que delegam para `window.Overview`. -31 linhas (708 → 677).
- `js/sections/consistency.js` — removida redundância de `.pr-weight` (já criada por `ui.js`).
- `PLANO.md` — reescrito refletindo o estado pós-redesign visual (era um snapshot do pré-refactor).
- `README.md` — atualizado com namespaces + shim pattern + link para LICENSE.

### Mudado
- `index.html` — adicionado `<script defer src="js/sections/overview.js">` antes de `js/render.js`.
- `js/render.js` — `renderKPIs` e `renderAdherence` agora são shims que delegam para `window.Overview`. -31 linhas (708 → 677).
- `PLANO.md` — reescrito refletindo o estado pós-redesign visual (era um snapshot do pré-refactor).

## [1.0.0] — 2026-08-04

### Adicionado
- 14 seções com dados reais: KPIs, volume mensal, top 10 1RM, heatmap, consistência, aderência, PRs, RPE, measurements, coach, equipment, etc.
- Filtros por URL: `?days`, `?from`, `?to`, `?tab`.
- 4 abas (`overview`, `strength`, `consistency`, `history`) com `?tab=` e `localStorage`.
- Cálculos determinísticos: Epley, PRs, streak semanal por segunda UTC, Δ período com tratamento de `previous=0`.
- Mobile-first: breakpoints, touch targets, safe-area, tipografia fluida, tabela responsiva.
- Acessibilidade: `lang`, `viewport-fit`, `aria-modal`, `Escape`, focus restore.
- Glassmorphism, toggle claro/escuro, micro-interações.
- Fallback `file://` com drag-and-drop.
- 79 testes verde (era 57 antes da rodada de cobertura de `data.js`).
- Deploy limpo em `gym-dashboard-brown-tau.vercel.app`.

[Não lançado]: https://github.com/william-gebowski-dev/gym-dashboard/compare/5de7999...HEAD
[1.0.0]: https://github.com/william-gebowski-dev/gym-dashboard/releases/tag/5de7999
