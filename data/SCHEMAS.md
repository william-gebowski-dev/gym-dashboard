# Schemas dos JSONs consumidos

Documentação dos campos efetivamente usados pelo dashboard. Atualizado
em 2026-08-04 após auditoria completa do código + dados reais.

> **Resumo:** 4 JSONs ativos consumidos em `js/`. Outros 20 listados em
> [Órfãos](#orfãos).

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

## `WorkoutSessionSet.json` ⚠️ consumido COM RESTRIÇÕES

Array de **3206 sets** com schema:

```jsonc
{
  "id": "uuid",
  "isComplete": true,
  "weight": 30,
  "reps": 12,
  "oneRepMax": 43.21,
  "maxReps": 12,
  "minReps": 8,
  "restTime": 60,
  "warmUp": false,
  "dropSet": false,
  "set": 1,
  "measurementUnit": "kg",
  "duration": ..., "expectedDuration": ..., "completedDate": ...,
  "workoutExerciseSet": "uuid"  // FK para WorkoutExerciseSet
}
```

### Limitação crítica

O JSON **não tem campo de data nem nome de exercício** (apenas FKs para
`WorkoutExerciseSet`). `workoutExerciseSet` aponta para o set *planejado*
do plano, não para uma sessão específica. Logo, não é possível ancorar
um set a uma data/treino sem fazer join.

### Estado atual

`js/rpe.js:buildScatterData` detecta se o JSON tem ancoragem temporal
(`date`/`completedDate`/`exerciseName`). Se não tem, retorna `[]` e a UI
exibe estado vazio elegante — **nenhum dado inventado**.

Se o export do GymBook/Strong futuramente incluir `completedDate` ou
`exerciseName` por set, o scatter RPE×%1RM aparece automaticamente.

---

## `CoachWorkout.json` ✅ consumido (ADERÊNCIA)

Array de **100 entradas**:

```jsonc
[
  {
    "id": "uuid",
    "workout": {
      "id": "uuid",
      "name": "Peito, Costas, Ombros, Bíceps, Tríceps",
      "exerciseList": [
        { "exercise": {...}, "workoutExerciseSets": [...] }
      ]
    }
  }
]
```

> Cada `CoachWorkout` representa um template de treino. O schema **não tem
> chave de data** (sem `scheduledDate`/`weekKey`), então a aderência
> semanal é calculada **derivada** dos próprios treinos reais
> (semanas com ≥ meta de treinos = aderência OK). Se o JSON futuramente
> trouxer `weekKey`, o `js/coach.js` anexa planejado automaticamente.

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

## Órfãos (20 arquivos NÃO consumidos)

| Arquivo | Tamanho | Recomendação | Por quê |
|---------|---------|--------------|---------|
| `Exercise.json` | 797 KB | Descartar | `WorkoutSession.exercise` já embute o necessário |
| `MeasurementLog.json` | 2 B | Aguardar | vazio, popular a partir do app |
| `MuscleGroup.json` | 2.3 KB | Descartar | inline em `WorkoutSession.exercise.primaryMuscleGroups` |
| `Equipment.json` | 12 KB | Descartar | substituído por `exercise.equipment` inline |
| `Bar.json` | 459 B | Descartar | metadata de barra, irrelevante |
| `Plate.json` | 1.8 KB | Descartar | inventário de anilhas |
| `Link.json` | 107 KB | Descartar | cross-refs internas do app |
| `User.json` | 1.8 KB | Descartar | perfil, não exibido |
| `UserPreferences.json` | 1.6 MB | Descartar | prefs sem utilidade |
| `Workout.json` | 1.9 MB | Descartar | templates, sem date/anchor |
| `WorkoutExercise.json` | 2.1 MB | Descartar | join sem uso |
| `WorkoutExerciseSet.json` | 491 KB | Descartar | sets planejados |
| `Schedule.json` | 1.7 MB | Descartar | cronograma sem ancoragem |
| `CoachAssessment.json` | 729 KB | Descartar | sem date/anchor |
| `CoachWeek.json` | 1.5 MB | Descartar | sem ancoragem |
| `ExerciseNotes.json` | 2.7 KB | Descartar | sem date |
| `Reminder.json` | 2 B | Aguardar | vazio |
| `StatisticsExercise.json` | 2 B | Aguardar | vazio |
| `WorkoutSessionExercise.json` | 3.1 MB | Descartar | redundante com `WorkoutSession.workoutSessionExercises` |

> **Resumo**: 0 incorporar agora, 3 aguardar popular, 17 descartar.

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