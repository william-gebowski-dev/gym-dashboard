# Refactor: arquitetura de informação, prescrição e refinamento visual

**Data:** 2026-08-06
**Status:** aprovado

## Problema

Perguntado sobre o que incomoda no dashboard, o usuário marcou as quatro opções:
não ajuda a treinar, parece genérico, é pesado, é confuso de navegar. E perguntado
que decisão quer tomar ao abrir, marcou as quatro: o que treinar hoje, que carga
usar, se está progredindo, se está sendo consistente.

As quatro reclamações têm uma raiz comum: **o app foi organizado em torno do modelo
de dados, não das perguntas de quem treina.** As abas se chamam Visão Geral, Força,
Consistência e Histórico — nomes de categoria de dado. Nenhuma superfície responde
"o que eu faço agora".

O exemplo que fecha o diagnóstico: os dados já sabem que peito e tríceps não são
treinados desde 11/05/2026 e que abdômen não é treinado desde 18/05/2025. O app
tem essa informação carregada em memória e nunca a mostra.

## Medições que sustentam (ou derrubam) cada queixa

| Queixa | Medição | Conclusão |
|---|---|---|
| "pesado / lento" | FCP 328 ms, DOM 236 ms, reparse do JSON 21 ms, 482 KB com gzip | **Não confirmado no desktop.** Falta medir em celular com CPU lenta antes de investir aqui. |
| "não me ajuda a treinar" | Nenhuma tela responde "o que treinar" ou "que carga" | Confirmado |
| "confuso de navegar" | 4 abas nomeadas por categoria de dado | Confirmado |
| "genérico" | Organização por tabela produz layout de dashboard qualquer | Confirmado, parcialmente decorrente dos dois acima |

## Viabilidade dos dados

Tudo abaixo sai de `data/WorkoutSession.json`, que já é carregado. Nenhum arquivo novo.

- **895 de 899 exercícios (99,6%) têm `primaryMuscleGroups`** → mapa de recência por grupo é calculável.
- **14 grupos musculares distintos** com data de último treino.
- **41 exercícios distintos com histórico de carga.**
- **80% das séries têm faixa de repetições explícita** (`minReps`/`maxReps`), e a faixa é **8–12** em 2.323 de 2.359 casos.
- **Incrementos de carga realmente usados:** +5 kg (57×), +1 kg (27×), +2 kg (21×), +10 kg (21×).

## Escopo

Três projetos independentes. Este spec cobre **A** e **B**; **C** fica para um spec
próprio, depois de medir em celular.

- **A. Arquitetura de informação + prescrição** — este spec
- **B. Refinamento visual dentro de escuro+vermelho** — este spec, aplicado às telas de A
- **C. Performance e arquitetura de código** — adiado, pendente de medição móvel

Direção visual definida pelo usuário: **manter escuro + vermelho e refinar dentro
disso.** A paleta categórica atual está validada para daltonismo e contraste e não
muda.

## A. Arquitetura de informação

Duas abas, nomeadas pelo momento de uso, no lugar de quatro nomeadas por tabela:

| Aba | Quando | Caráter |
|---|---|---|
| **Hoje** | Antes de treinar | Prescritivo. Poucos elementos. Decisão em segundos. |
| **Evolução** | Depois, ocasionalmente | Analítico. Denso. Para explorar. |

**Hoje** contém, nesta ordem:

1. **Tira de 12 semanas** (já existe em `js/streak.js`) — "estou aparecendo?"
2. **Mapa de grupos por recência** — 14 grupos ordenados por dias desde o último
   treino, com a carga visual no *atraso*, não no volume.
3. **Próxima carga** — ao escolher um grupo, os exercícios dele com última carga
   registrada e a sugestão.

**Evolução** absorve o conteúdo analítico atual — KPIs, card de resumo, volume
mensal, top 1RM, intensidade, comparação de exercícios, recordes, heatmap e
histórico de sessões — como seções roláveis com âncoras, não como abas. Conteúdo
consultado ocasionalmente não justifica navegação de primeiro nível.

**O seletor de período (Tudo/30d/90d/180d/365d) pertence a "Evolução" e sai da
hero.** Ele é um controle analítico: filtra a leitura do passado. "Hoje" responde
sobre agora e ignora o filtro por definição — a tira de 12 semanas e a recência
dos grupos sempre usam o histórico completo, porque "que grupo está atrasado" não
muda conforme a janela que você escolheu olhar.

O modal de drill-down da sessão permanece como está e continua acessível dos dois
lados (tira, heatmap, tabela de sessões).

### Regra de sugestão de carga

Dupla progressão, derivada do comportamento já registrado do usuário — não inventada.

```
Para cada exercício, olhando a ÚLTIMA sessão em que ele apareceu:

  faixa      = (minReps, maxReps) da série, ou (8, 12) se ausente
  trabalho   = séries completas, não-aquecimento, com peso > 0
  incremento = menor incremento positivo que o usuário já aplicou
               NESTE exercício; se não houver histórico, 2,5 kg

  SE todas as séries de trabalho atingiram maxReps:
      sugerir peso + incremento, voltando ao piso da faixa
  SENÃO:
      sugerir o mesmo peso, mirando +1 repetição na série mais fraca
```

**Restrições obrigatórias na apresentação:**

- A sugestão sempre aparece **ao lado do que foi feito**, nunca sozinha. O usuário
  precisa ver "8×80 kg na última vez" junto de "tente 8×85 kg".
- A regra fica **visível na interface** (um "por quê?" que a explica), não só no
  código. Sugestão de carga sem regra visível é palpite com cara de autoridade.
- Sem histórico suficiente (exercício novo, menos de 1 sessão registrada), o app
  **não sugere**. Mostra "sem histórico" e para.
- Nenhuma sugestão para exercícios cuja última sessão tem mais de 180 dias — a
  premissa de continuidade não vale mais. Mostra a última carga e sinaliza a lacuna.

### Estados vazios

| Situação | O que mostrar |
|---|---|
| Grupo nunca treinado | "Nenhum registro" + convite a escolher outro grupo |
| Exercício sem histórico | Última carga em branco, sem sugestão |
| Lacuna > 180 dias | Última carga + "há N meses", sem sugestão |
| Sem sessões (arquivo vazio) | Estado vazio da app inteira, já existente |

## B. Refinamento visual

Dentro de escuro + vermelho. Nada de nova paleta.

1. **Escala tipográfica com intenção.** Hoje o corpo é 15 px e quase tudo vive entre
   0,7 e 1,1 rem. A escala passa a ter degraus declarados como tokens
   (`--text-xs` … `--text-3xl`), e o número — que é o conteúdo — ocupa o topo dela.
2. **Sistema de espaçamento.** Substituir os valores avulsos (13 px, 17 px, 19 px,
   21 px) por uma escala de 4 px em tokens. O ritmo vertical inconsistente é parte
   do que faz o layout parecer montado, não desenhado.
3. **Densidade por superfície.** "Hoje" é arejado e grande; "Evolução" é denso e
   compacto. Hoje as duas têm a mesma densidade, o que apaga a diferença de uso.
4. **Um acento por vista.** Já iniciado (tiques vermelhos removidos). Estender a
   disciplina às telas novas.
5. **`css/style.css` tem 1.061 linhas** e é o arquivo que mais cresce. Dividir em
   `tokens.css`, `base.css`, `components.css` e `sections.css`, importados na ordem.
   Sem pré-processador e sem build.

## Componentes

| Arquivo | Responsabilidade | Depende de |
|---|---|---|
| `js/prescribe.js` (novo) | Regra de progressão pura: recebe sessões, devolve sugestão por exercício. Sem DOM. | — |
| `js/muscles.js` (novo) | Recência por grupo muscular. Sem DOM. | — |
| `js/sections/today.js` (novo) | Renderiza a aba Hoje | State, UI, Charts, prescribe, muscles, streak |
| `js/sections/evolution.js` (novo) | Orquestra as seções analíticas | as seções existentes |
| `js/streak.js` | Sem mudança | State |
| `js/render.js` | Façade encolhe: delega para today/evolution | seções |
| `css/tokens.css` etc. (novos) | `style.css` dividido | — |

`prescribe.js` e `muscles.js` são funções puras de propósito: entram dados, saem
dados, sem tocar no DOM. É o que permite testá-las com `node --test` sem browser,
como já é feito em `tests/pure-fns.test.js`.

## Testes

Segue o padrão atual (`node --test`, zero dependências).

- `tests/prescribe.test.js` — a regra de progressão: bateu o topo sobe; não bateu
  mantém; sem histórico não sugere; lacuna > 180 dias não sugere; incremento sai do
  histórico do próprio exercício; faixa ausente usa 8–12.
- `tests/muscles.test.js` — recência por grupo: ordenação, grupo nunca treinado,
  exercício sem grupo não quebra a conta.
- Regressão: os 117 testes atuais continuam passando.
- Verificação em browser real (Playwright) das duas abas em desktop e mobile, sem
  erro de console e sem overflow horizontal.

## Riscos

| Risco | Mitigação |
|---|---|
| Sugestão de carga errada leva a lesão | Regra conservadora e visível; nunca sugere sem histórico; sempre ao lado do que foi feito |
| Fundir 4 abas em 2 esconde conteúdo que ele usava | "Evolução" mantém tudo, com âncoras; nada é removido |
| Refactor visual e funcional junto dificulta achar regressão | Commits separados por natureza (estrutura, depois estilo) |
| O usuário não abre "Hoje" antes de treinar e a aba morre | Aceito: é a hipótese central do refactor. Se falhar, "Hoje" vira uma seção de "Evolução" e o custo é pequeno |

## Fora de escopo

- Mudança de paleta ou de direção visual
- Projeto C (performance/arquitetura) — spec próprio, depois de medir em celular
- Registro de treinos pelo app (o dashboard é somente leitura)
- Qualquer feature que exija dado que o export não traz
