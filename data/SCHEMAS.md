# Schemas dos JSONs consumidos

Documentação dos campos efetivamente usados pelo dashboard.

> **Resumo:** 3 JSONs consumidos em `js/` — `WorkoutSession.json`,
> `Measurement.json` e `MeasurementLog.json`. Os demais foram removidos
> (ver [Arquivos removidos](#arquivos-removidos-do-repositório)).

---

## `WorkoutSession.json` ✅ consumido (PRINCIPAL)

Array de **140 sessões** (todas com `endDate`). Cada sessão:

```jsonc
{
  "id": "uuid",
  "name": "Treino A",
  "startDate": "2026-07-15T18:30:00Z",     // ISO 8601 UTC — ancoragem temporal
  "endDate":   "2026-07-15T19:42:00Z",     // usado para `durationMin`
  "isComplete": true,
  "workoutSessionExercises": [
    {
      "exercise": {
        "name": "Puxada Frontal",
        "equipment": "Cable Machine",
        "primaryMuscleGroups":   [{ "id":"...", "name":"..." }],
        "secondaryMuscleGroups": [{ "id":"...", "name":"..." }]
      },
      "workoutSessionSets": [
        {
          "set": 1,
          "warmUp": false,
          "dropSet": false,
          "isComplete": true,
          "weight": 30.0,        // kg (ver measurementUnit)
          "reps": 12,
          "minReps": 8,
          "maxReps": 12,
          "restTime": 60,        // segundos
          "oneRepMax": 43.215214 // calculado pelo app de origem (Epley)
        }
      ]
    }
  ]
}
```

### Campos consumidos por `js/`

| Campo                                                    | Onde aparece                                |
|----------------------------------------------------------|----------------------------------------------|
| `id`, `name`, `startDate`, `endDate`                     | `data.js:normalizeSession`                  |
| `workoutSessionExercises[].exercise.name`                | charts, dropdowns, PRs                      |
| `workoutSessionExercises[].exercise.primaryMuscleGroups` | (futuro) filtro de grupo                    |
| `workoutSessionSets[].weight`, `.reps`                  | volume (`weight × reps`), KPIs              |
| `workoutSessionSets[].oneRepMax`                         | PRs, scatter RPE                            |
| `workoutSessionSets[].restTime`                          | `totalRestSec` (ainda não exibido)          |
| `workoutSessionSets[].isComplete`                        | filtro obrigatório para qualquer cálculo    |

### Cálculos derivados (em `data.js`)

- **Volume sessão** = Σ `weight × reps` para `isComplete: true`
- **PR por exercício** = maior `pickOneRepMax(set)` histórico
- **`pickOneRepMax(set)`** = `set.oneRepMax` se > 0; senão Epley
- **Δ período** = `(current - previous) / previous × 100`, arredondado.
  Retorna `null` quando `previous ≤ 0` (sem base).

---

## Arquivos removidos do repositório

Quatro JSONs foram removidos por nunca terem sido lidos por nenhum código.
Continuam no histórico do git (`git show <commit>^:data/<arquivo>`) e podem
voltar se um export futuro trouxer os campos que faltam.

| Arquivo | Tamanho | Por que saiu |
|---|---|---|
| `WorkoutSessionSet.json` | 1,0 MB | Sem `date` e sem `exerciseName`: um set não podia ser ancorado a uma data ou exercício. Os mesmos 3221 sets já vêm aninhados em `WorkoutSession.json`, e lá **com** nome e data — é de lá que `js/intensity.js` lê. |
| `CoachWorkout.json` | 1,5 MB | Sem `scheduledDate`/`weekKey`, aderência ao plano é incalculável. O painel mostrava `unknown 0/4` e duplicava "Aderência Semanal". |
| `CoachWeek.json` | 1,5 MB | Superset de `CoachWorkout.json`, com a mesma ausência de datas. Nunca foi buscado. |
| `Exercise.json` | 800 KB | Catálogo estático de 576 exercícios. Os nomes que o app usa já vêm aninhados em `WorkoutSession.json`. |

---

## `Measurement.json` ✅ consumido (CATÁLOGO)

Array de **19 tipos de medida** (Weight, Body Fat %, Neck, etc.):

```jsonc
{
  "id": "uuid",
  "name": "Weight",
  "measurementType": "weight",
  "tracked": true,
  "custom": false
}
```

Catálogo é carregado; `MeasurementLog.json` (logs) está vazio no export,
então `js/measurements.js:buildTimeline` retorna `[]` e UI mostra
"Sem medidas registradas ainda".

---

## O que o export original trazia

O export do GymBook/Strong gera ~24 JSONs. A maioria nunca chegou a ser
commitada aqui, e os que chegaram foram removidos (tabela acima). Os motivos
se repetem: são tabelas de join (`WorkoutExercise.json`,
`WorkoutSessionExercise.json`), catálogos que o `WorkoutSession.json` já
embute inline (`MuscleGroup.json`, `Equipment.json`, `Exercise.json`),
preferências e perfil sem uso na UI, ou templates sem ancoragem temporal
(`Workout.json`, `Schedule.json`, `CoachAssessment.json`).

O padrão vale como regra ao avaliar um arquivo novo: **se ele não tem uma
data e não tem um nome de exercício, ele não consegue virar um ponto em
nenhum gráfico deste dashboard.**

---

## Validação programática

```bash
npm run validate  # roda scripts/validate-data.js
```

Valida:
- Cada arquivo parseável como JSON
- `WorkoutSession.json` é array
- Cada sessão tem `id` + `startDate`
- Cada exercício tem `exercise.name`
- Cada set completo tem `weight` numérico

Saída: contagem de sessões + lista de exercícios + exercícios únicos.