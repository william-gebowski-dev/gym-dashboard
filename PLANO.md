# 📋 Estado Atual & Roadmap — gym-dashboard

> Snapshot pós-refactor (commit `5de7999`). O `PLANO.md` antigo (pré-refactor, 03/08) está obsoleto — tratava de `js/app.js` com 17 linhas, single-file `index.html` com 373 linhas e 23 JSONs. Hoje a realidade é outra.

## Estado Atual (04/08/2026)

### Repo
- GitHub: `william-gebowski-dev/gym-dashboard` ✅
- HEAD: `5de7999 Redesign visual completo: CSS profissional premium`
- Branch: `main`, status limpo
- Deploy: `gym-dashboard-brown-tau.vercel.app`

### Estrutura
```
gym-dashboard/
├── index.html              150 linhas   shell semântico
├── css/
│   └── styles.css        1.727 linhas   extraído do <style>
├── js/
│   ├── data.js             278 linhas   fetch + normalize + compute (puro)
│   ├── state.js            107 linhas   App global + URL + localStorage
│   ├── render.js           708 linhas   ★ principal ponto de risco
│   ├── charts.js            40 linhas   pool Chart.js
│   ├── summary.js           44 linhas   resumo textual determinístico
│   ├── coach.js             61 linhas   aderência semanal
│   ├── rpe.js               62 linhas   scatter RPE×%1RM
│   ├── measurements.js      38 linhas   timeline de medidas corporais
│   ├── export.js            37 linhas   PNG + share URL
│   ├── tabs.js              35 linhas   navegação por abas
│   ├── i18n.js              64 linhas   strings PT-BR centralizadas
│   ├── drop.js              93 linhas   fallback drag-and-drop file://
│   ├── ui.js               267 linhas   primitivas DOM-safe
│   └── main.js             107 linhas   entry point
├── data/                    (ignorado do git via .gitignore)
│   ├── WorkoutSession.json  4,2 MB  ← principal, 140 sessões
│   ├── Measurement.json
│   ├── MeasurementLog.json
│   ├── WorkoutSessionSet.json
│   ├── CoachWorkout.json
│   └── SCHEMAS.md
├── tests/
│   ├── pure-fns.test.js   (79 testes, 17 suítes)
│   └── aggregate.test.js  (dados reais: 140 sessões, schema, etc)
├── scripts/validate-data.js
├── vercel.json
└── README.md
```

### O que funciona (✅)
- 14 seções com dados reais: KPIs, volume mensal, top 10 1RM, heatmap, consistência, aderência, PRs, RPE, measurements, coach, equipment, etc.
- Filtros por URL: `?days`, `?from`, `?to`, `?tab`.
- 4 abas (`overview`, `strength`, `consistency`, `history`) com `?tab=` e `localStorage`.
- Cálculos determinísticos: Epley, PRs, streak semanal por segunda UTC, Δ período com tratamento de `previous=0`.
- Mobile-first: breakpoints, touch targets, safe-area, tipografia fluida, tabela responsiva.
- Acessibilidade: `lang`, `viewport-fit`, `aria-modal`, `Escape`, focus restore.
- Glassmorphism, toggle claro/escuro, micro-interações.
- Fallback `file://` com drag-and-drop.
- `npm test`: 79 testes verde.
- `npm run validate`: 140 sessões / 899 exercícios / 3245 séries — schema OK.
- Deploy limpo: `vercel.json` só com cache + security headers (sem rewrites).

### Pontos de risco (⚠️)
- **`js/render.js` com 708 linhas** concentra lógica de múltiplas seções. Maior alvo de refactor.
- Sem CI: `npm test` não roda automaticamente em PR.
- `data/WorkoutSession.json` (4,2 MB) ignorado do git, mas **necessário** para o app rodar fora de `file://`. Demo público não roda sem o JSON.
- `PLANO.md` antigo ainda no repo (este arquivo o substitui).

---

## 🎯 Roadmap

### Curto prazo (próximas sessões)
1. **Modularizar `js/render.js`** — quebrar em `js/sections/*.js` reaproveitando `js/ui.js` como primitiva. Manter `npm test` verde.
2. **Adicionar CI no GitHub Actions** — `.github/workflows/ci.yml` rodando `npm test` + `npm run validate` em Node 18 e 20.
3. **Adicionar `LICENSE` MIT** — trivial, falta.
4. **Adicionar `CHANGELOG.md`** — explicitar o que cada commit mudou.

### Médio prazo
5. **Snapshot anonimizado** — `scripts/anonymize.js` gerando `data/sample/workouts.sample.json` (commitável, sem PII) para reprodutibilidade do demo.
6. **EditorConfig + Prettier mínimo** — alinhamento entre contribuições.
7. **Documentar schema no README** — `data/SCHEMAS.md` já existe, mas está só no repo. Promover para seção do README.

### Longo prazo
8. **Migrar para build?** — manter vanilla é uma decisão consciente, mas se crescer muito, considerar Vite.
9. **PWA** — instalar no celular, funcionar offline (Service Worker + manifest).
10. **Comparação de períodos** — mês vs mês, com filtro de grupo muscular.

---

## 📊 Métricas atuais

- 140 sessões, 48 exercícios, 3206 séries, 804k volume.
- 79 testes verde (era 57 antes da rodada de cobertura de `js/data.js`).
- Cobertura por função pública de `data.js`: todas as 12 funções têm pelo menos 1 teste de borda.
- `js/render.js`: 708 linhas / 14 seções → ~50 linhas por seção. Acima do limiar confortável.
