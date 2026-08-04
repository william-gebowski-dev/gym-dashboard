#!/usr/bin/env node
/**
 * validate-data.js
 *
 * Valida que data/WorkoutSession.json parseia e tem schema mínimo.
 * Pré-requisito para Fase 0 → Fase 2 (refatoração em ES modules).
 *
 * Uso:  node scripts/validate-data.js
 * Exit: 0 se OK, 1 se falhar.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dataPath = resolve(root, 'data/WorkoutSession.json');

if (!existsSync(dataPath)) {
  console.error(`✗ Arquivo não encontrado: ${dataPath}`);
  process.exit(1);
}

let ws;
try {
  ws = JSON.parse(readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error(`✗ Falha ao parsear JSON: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(ws)) {
  console.error('✗ WorkoutSession.json deve ser um array de sessões.');
  process.exit(1);
}

let sessoesOk = 0;
let totalExercicios = 0;
let totalSets = 0;
let erros = 0;

for (const s of ws) {
  if (!s.id || !s.startDate) {
    console.error(`✗ Sessão sem id/startDate: ${JSON.stringify(s).slice(0, 100)}`);
    erros++;
    continue;
  }
  sessoesOk++;

  const exercises = s.workoutSessionExercises ?? [];
  for (const ex of exercises) {
    if (!ex.exercise?.name) {
      console.error(`✗ Exercise sem name em sessão ${s.id}: ${ex.id}`);
      erros++;
      continue;
    }
    totalExercicios++;

    const sets = ex.workoutSessionSets ?? [];
    for (const set of sets) {
      // Sets de exercícios baseados em duração (ex.: prancha, abdominal hold)
      // não têm weight/reps — em vez disso carregam duration (ms).
      if (typeof set.duration === 'number') {
        totalSets++;
        continue;
      }
      // Sets não concluídos podem ter peso zero ou ausente sem ser erro.
      if (set.isComplete === false) {
        totalSets++;
        continue;
      }
      // Bodyweight exercises (sem `weight`) — `reps` é obrigatório, `weight` é opcional.
      if (typeof set.weight === 'undefined') {
        if (typeof set.reps !== 'number') {
          console.error(`✗ Set bodyweight sem reps em sessão ${s.id} / ex ${ex.exercise.name}: ${JSON.stringify(set).slice(0, 100)}`);
          erros++;
          continue;
        }
        totalSets++;
        continue;
      }
      if (typeof set.weight !== 'number' || Number.isNaN(set.weight)) {
        console.error(`✗ Set weight inválido em sessão ${s.id} / ex ${ex.exercise.name}: ${JSON.stringify(set).slice(0, 100)}`);
        erros++;
        continue;
      }
      if (typeof set.reps !== 'number') {
        console.error(`✗ Set reps inválido em sessão ${s.id} / ex ${ex.exercise.name}: ${JSON.stringify(set).slice(0, 100)}`);
        erros++;
        continue;
      }
      totalSets++;
    }
  }
}

if (erros > 0) {
  console.error(`\n✗ ${erros} erro(s) de schema. ${sessoesOk}/${ws.length} sessões válidas.`);
  process.exit(1);
}

console.log(`✓ ${sessoesOk} sessões, ${totalExercicios} exercícios, ${totalSets} séries — schema OK.`);
