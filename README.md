# 💪 Evolução na Academia — Gym Dashboard

Dashboard pessoal vanilla-JS + Chart.js para visualizar sessões de treino exportadas (formato GymBook / Strong app).

## Stack

- **HTML + CSS + JS vanilla** (sem build, sem framework, sem `node_modules`)
- **Chart.js 4.5.1** via CDN, com versão pinada na URL e hash SRI correspondente
- **JSONs estáticos** em `data/`, dos quais o app consome apenas três: `WorkoutSession.json`, `Measurement.json` e `MeasurementLog.json`

> A URL do Chart.js e o `integrity` andam juntos: ao trocar a versão é obrigatório
> recalcular o hash, senão o browser bloqueia o script e todos os gráficos somem.
> ```bash
> curl -sL https://cdn.jsdelivr.net/npm/chart.js@<versão>/dist/chart.umd.min.js | openssl dgst -sha384 -binary | openssl base64 -A
> ```

## Como rodar

O `fetch()` falha quando aberto direto via `file://`. Use um servidor estático local:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

> **Fallback**: se o `fetch()` falhar (ex.: ainda em `file://`), o dashboard oferece
> drag-and-drop para você arrastar `data/WorkoutSession.json` manualmente.

## Estrutura

```
gym-dashboard/
├── index.html          # markup + ordem de carga dos módulos
├── css/style.css       # folha única, tokens em :root
├── js/                 # namespaces globais (sem bundler, a ordem importa)
│   ├── state.js        # App, filtros, URL, localStorage
│   ├── data.js         # fetch, normalização, PRs, deltas de período
│   ├── charts.js       # paleta + pool de Chart.js
│   ├── render.js       # KPIs, charts, heatmap, PRs, tabela
│   ├── intensity.js    # dispersão carga × repetições
│   └── ...
├── data/               # JSONs do GymBook/Strong (ver data/SCHEMAS.md)
├── scripts/            # validate-data.js
└── tests/              # node --test
```

## Verificação

```bash
node --test tests/aggregate.test.js
```

```bash
node scripts/validate-data.js
```

## Cores dos gráficos

A paleta categórica em [`js/charts.js`](js/charts.js) não é escolhida a olho — os
oito tons **e a ordem deles** foram validados contra a superfície real dos cards
(`#101318`). A ordem é o mecanismo de segurança para daltonismo: **reordenar exige
revalidar**.

| Teste | Resultado |
|---|---|
| Pares adjacentes (barras, linhas) | CVD ΔE 9.4 · visão normal ΔE 19.3 |
| Todos os pares, 3 primeiros slots (scatter) | CVD ΔE 8.6 · visão normal ΔE 29.0 |
| Contraste vs superfície | todos ≥ 3:1 |
| Rampa do heatmap | L monotônica, degrau mais escuro a 2.10:1 |

Três regras que costumam surpreender:

- **Gráfico de uma série usa sempre o slot 1.** Pintar cada card de uma cor
  diferente gasta o canal de identidade sem codificar nada — a cor passa a
  significar "qual card", não "qual série".
- **A cor acompanha a entidade, não a posição na seleção.** Em "Comparar
  Exercícios", indexar pela ordem dos marcados fazia os sobreviventes trocarem de
  cor ao desmarcar um item.
- **Scatter tem teto de 3 séries coloridas.** Ali qualquer par de pontos pode
  encostar, o que é um teste mais duro que o de vizinhança; o resto vai para
  "Outros" em cinza.

Todo gráfico tem um gêmeo em tabela (botão "Ver tabela"): o gráfico nunca é o
único caminho até o valor.

## Notas sobre os dados

- `oneRepMax` no dataset é **estimado por série** por uma fórmula que depende
  apenas das repetições — 30 kg × 12 e 35 kg × 12 produzem o mesmo percentual.
  Por isso o gráfico de intensidade usa como referência o melhor 1RM do
  exercício em todo o histórico, não o `oneRepMax` da própria série.
- Não existe campo de RPE nos dados. Qualquer "RPE" seria inventado.
- `CoachWorkout.json` e `CoachWeek.json` não têm nenhum campo de data ou semana,
  então não dá para calcular aderência ao plano do coach. O painel foi removido;
  os arquivos seguem no repositório caso um export futuro traga esses campos.
- `MeasurementLog.json` está vazio, então "Evolução Corporal" mostra o estado
  vazio até haver medidas registradas.

Veja [`data/SCHEMAS.md`](data/SCHEMAS.md) para os campos por arquivo.
