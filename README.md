# 💪 Evolução na Academia — Gym Dashboard

Dashboard pessoal vanilla-JS + Chart.js para visualizar sessões de treino exportadas (formato GymBook / Strong app).

## Stack

- **HTML + CSS + JS vanilla** (sem build, sem framework, sem `node_modules`)
- **Chart.js 4.4.7** carregado via CDN (`cdn.jsdelivr.net`)
- **24 JSON estáticos** em `data/` (apenas `WorkoutSession.json` e `CoachWorkout.json` são consumidos)

## Como rodar

O `fetch()` falha quando aberto direto via `file://`. Use um servidor estático local:

```bash
# Opção 1: Python (já instalado em Linux/macOS)
python3 -m http.server 8000

# Opção 2: Node
npx serve -p 8000
```

Abra `http://localhost:8000`.

> **Fallback**: se o `fetch()` falhar (ex.: ainda em `file://`), o dashboard carrega um JSON embutido e oferece drag-and-drop para você arrastar `data/WorkoutSession.json` manualmente.

## Estrutura

```
gym-dashboard/
├── index.html                  # App monolítico (~730 KB com JSON embutido)
├── data/                       # 24 JSONs do GymBook/Strong
│   ├── WorkoutSession.json     # ← principal (4.4 MB)
│   ├── CoachWorkout.json       # ← aderência ao coach
│   └── ... (22 outros, ver data/SCHEMAS.md)
├── archive/                    # Backups antigos (gitignored)
├── .gitignore
└── README.md
```

## Atalhos / filtros

- **Grupo muscular**: dropdown no header filtra gráficos de exercícios, PRs e progresso.
- **Exercício**: dropdown acima do gráfico de progresso individual.
- **Re-render**: cada mudança de filtro re-renderiza KPIs, charts e tabela.

## Dados

Veja [`data/SCHEMAS.md`](data/SCHEMAS.md) para os campos consumidos por arquivo e o que está atualmente **órfão** (não lido pelo app).

## Roadmap

Plano completo de melhorias em [`/home/william/.claude/plans/analise-o-gym-dashboard-swirling-giraffe.md`](/home/william/.claude/plans/analise-o-gym-dashboard-swirling-giraffe.md). Fases:

- **Fase 0 — Higiene** ✅ limpar raiz, schemas, testes de parsing
- **Fase 1 — Performance** memo de `buildState`, pool de Chart.js
- **Fase 2 — Modularização** quebrar monolito em ES modules
- **Fase 3 — Visualizações novas** heatmap mensal, PRs com sparkline, streak
- **Fase 4 — Features avançadas** RPE, densidade, coach dashboard rico, medidas corporais
- **Fase 5 — Polish** export PNG, share link, audit mobile
