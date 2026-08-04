# Schemas dos JSONs consumidos

Documentação dos campos efetivamente usados pelo dashboard. Atualizado em 2026-08-03 a partir de uma inspeção direta de `data/WorkoutSession.json` e `data/CoachWorkout.json`.

> ⚠️ Apenas **2 dos 24 arquivos** em `data/` são consumidos pelo `index.html`. Os outros 22 estão listados em [Órfãos](#orfãos) com sugestão de uso ou descarte.

---

## `WorkoutSession.json` ✅ consumido

Array de **139 sessões**. Cada sessão:

```jsonc
{
  "id": "uuid",
  "name": "Treino A",                      // Nome legível
  "startDate": "2026-07-15T18:30:00Z",     // ISO 8601 UTC
  "endDate":   "2026-07-15T19:42:00Z",     // usado em F2 (duração)
  "isComplete": true,
  "workoutSessionExercises": [             // ⚠️ não é "exercises"
    {
      "id": "uuid",
      "position": 0,
      "type": "weighted",                   // ou "warmup", etc.
      "supersetExercises": [],
      "exercise": {                         // metadados embutidos por exercício
        "id": "uuid",
        "name": "Puxada Frontal",
        "category": "weight_and_reps",
        "custom": false,
        "deleted": false,
        "equipment": "Cable Machine",
        "equipmentRequired": [{ "id":"...", "name":"...", "thumbnailUrl":"..." }],
        "experienceLevel": 1,
        "mechanicsType": "compound",
        "instructions": "...",
        "primaryMuscleGroups":   [{ "id":"...", "name":"..." }],
        "secondaryMuscleGroups": [{ "id":"...", "name":"..." }],
        "emphasizedRegions":     [{ "id":"...", "name":"..." }],
        "thumbnailUrl":          "https://d3r2akiggou3b8.cloudfront.net/.../320.png",
        "standardResolutionUrl": "https://...",
        "rating": 4.5
      },
      "workoutSessionSets": [               // ⚠️ não é "sets"
        {
          "id": "uuid",
          "set": 1,                         // número da série na sessão
          "warmUp": false,
          "dropSet": false,
          "untilFailure": false,
          "isComplete": true,
          "weight": 30.0,                   // float, em kg (ver measurementUnit)
          "reps": 12,                       // int
          "minReps": 8,                     // range planejado
          "maxReps": 12,
          "measurementUnit": "kg",
          "restTime": 60,                   // segundos
          "oneRepMax": 43.215214            // calculado pelo app de origem
        }
      ]
    }
  ]
}
```

### Campos usados pelo `index.html` atual

| Campo | Onde aparece |
|-------|--------------|
| `startDate` | filtro/ordenação, monthlyVolume, weekdayCounts, PRs, exerciseProgress |
| `name` | sessionsTable, dropdown do coach |
| `workoutSessionExercises[].exercise.name` | todos os charts e dropdowns |
| `workoutSessionExercises[].exercise.primaryMuscleGroups` | filtro "grupo muscular" |
| `workoutSessionExercises[].workoutSessionSets[].weight` | volumeChart, KPIs, PRs |
| `workoutSessionExercises[].workoutSessionSets[].reps` | volumeChart (`weight * reps`) |
| `workoutSessionExercises[].workoutSessionSets[].oneRepMax` | oneRmChart, exerciseProgressChart |

### Campos disponíveis ainda **não usados** (oportunidades)

| Campo | Possível uso |
|-------|--------------|
| `endDate` | F2 — duração de sessão, histograma, KPI "duração média" |
| `workoutSessionSets[].restTime` | F2 — densidade, "tonelagem/minuto" |
| `workoutSessionSets[].oneRepMax` × `weight` | F1 — gráfico de intensidade relativa (%1RM) |
| `exercise.equipment` | U1 — filtro por equipamento |
| `exercise.thumbnailUrl` | U4/F2 — ícones nos cards |
| `exercise.standardResolutionUrl` | U4 — lightbox no drill-down |
| `workoutSessionSets[].dropSet` / `warmUp` | F2 — separar volume efetivo de aquecimento |
| `exercise.instructions` | U3 — drill-down do exercício |

---

## `CoachWorkout.json` ✅ consumido (parcialmente)

Array de **100 entradas**. Schema mínimo:

```jsonc
[
  {
    "id": "uuid",
    "workout": "uuid"          // FK para Workout.json (templates de plano)
  }
]
```

> ⚠️ O schema é **muito raso**. O dashboard atual consome apenas `id` para listar aderência. Para o **F4 (aderência rica)** descrito no plano, vamos precisar carregar `Workout.json` + `WorkoutExercise.json` + `WorkoutExerciseSet.json` (volume combinado ≈ 4.5 MB) e fazer join por data/semana.

---

## Órfãos

22 arquivos em `data/` que **não são lidos pelo `index.html`**. Decisão recomendada:

| Arquivo | Tamanho | Recomendação | Justificativa |
|---------|---------|--------------|---------------|
| `Exercise.json` | 797 KB | **Incorporar** | catálogo tem `thumbnailUrl` — habilita U4 (thumbnails nos cards) |
| `Measurement.json` | 2.3 KB | **Incorporar** | habilita F5 (dashboard de medidas corporais) |
| `MeasurementLog.json` | 2 B | Aguardar | vazio — popular a partir do app de origem |
| `MuscleGroup.json` | 2.3 KB | Manter | já presente em `WorkoutSession.exercise.primaryMuscleGroups`, mas pode acelerar lookups por nome |
| `Equipment.json` | 12 KB | Descartar | substituído por `exercise.equipment` inline |
| `Bar.json` | 459 B | Descartar | metadata de barra, irrelevante para métricas |
| `Plate.json` | 1.8 KB | Descartar | inventário de anilhas, irrelevante |
| `Link.json` | 107 KB | Descartar | cross-references internas do app de origem |
| `User.json` | 1.8 KB | Descartar | perfil (displayName etc.) — não exibido |
| `UserPreferences.json` | 1.6 MB | Descartar | prefs do app de origem, sem utilidade |
| `Workout.json` | 1.9 MB | **Manter (futuro)** | templates de treino — habilita F4 (aderência) |
| `WorkoutExercise.json` | 2.1 MB | **Manter (futuro)** | join table Workout↔Exercise — habilita F4 |
| `WorkoutExerciseSet.json` | 491 KB | **Manter (futuro)** | sets planejados — habilita F4 |
| `Schedule.json` | 1.7 MB | **Manter (futuro)** | cronograma planejado — habilita F4 |
| `CoachAssessment.json` | 729 KB | **Manter (futuro)** | avaliações do coach — habilitaria analytics |
| `CoachWeek.json` | 1.5 MB | **Manter (futuro)** | plano semanal do coach — habilita F4 |
| `ExerciseNotes.json` | 2.7 KB | **Incorporar (futuro)** | notas por exercício — habilita tooltip em U4 |
| `Reminder.json` | 2 B | Aguardar | vazio |
| `StatisticsExercise.json` | 2 B | Aguardar | vazio |
| `WorkoutSessionExercise.json` | 3.1 MB | **Manter (futuro)** | drill-down de cada exercício na sessão (U3) |
| `WorkoutSessionSet.json` | 1.0 MB | **Manter (futuro)** | habilita F1 (RPE) e F2 (densidade) |

**Resumo:**
- **Incorporar agora**: `Exercise.json`, `Measurement.json`
- **Guardar para Fase 4**: `WorkoutSessionSet.json`, `WorkoutSessionExercise.json`, todos os `Workout*.json`, `Coach*`, `Schedule.json`, `ExerciseNotes.json`
- **Descartar com segurança**: `Equipment.json`, `Bar.json`, `Plate.json`, `Link.json`, `User.json`, `UserPreferences.json`
- **Aguardar popular**: `MeasurementLog.json`, `Reminder.json`, `StatisticsExercise.json`

---

## Validação programática

Planejado para Fase 0 → Fase 2 (refatoração em ES modules):

```js
// scripts/validate-data.js (Node, sem deps)
import { readFileSync } from 'node:fs';

const ws = JSON.parse(readFileSync('data/WorkoutSession.json', 'utf8'));
if (!Array.isArray(ws)) throw new Error('WorkoutSession.json deve ser array');
for (const s of ws) {
  if (!s.id || !s.startDate) throw new Error(`Sessão sem id/startDate: ${JSON.stringify(s).slice(0,80)}`);
  for (const ex of s.workoutSessionExercises ?? []) {
    if (!ex.exercise?.name) throw new Error(`Exercise sem name: ${ex.id}`);
    for (const set of ex.workoutSessionSets ?? []) {
      if (typeof set.weight !== 'number') throw new Error(`Set weight inválido: ${JSON.stringify(set).slice(0,80)}`);
    }
  }
}
console.log(`OK: ${ws.length} sessões validadas`);
```
