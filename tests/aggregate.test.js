/**
 * tests/aggregate.test.js
 *
 * Testes das funções de parsing/agregação do gym-dashboard.
 *
 * Como `summarizeSession`, `toNumber`, `extractMuscles` ainda estão
 * dentro do IIFE do index.html (pré-M1), reimplementamos aqui as
 * assinaturas exatas como contrato. Quando M1 extrair os módulos,
 * estes imports vão apontar para js/data.js diretamente.
 *
 * Uso:  node --test tests/aggregate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/* ─── Funções-contrato (assinas exatas do index.html) ──────────── */

/**
 * toNumber(value) — coerção segura para número.
 * Reimplementada idêntica ao index.html linhas 561–564.
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * extractMuscles(exercise) — coleta nomes de muscles do objeto `exercise`
 * (o campo aninhado dentro de workoutSessionExercises[i].exercise).
 * Reimplementada idêntica ao index.html linhas 549–558.
 */
function extractMuscles(exercise) {
  const muscles = new Set();
  for (const source of ['primaryMuscleGroups', 'secondaryMuscleGroups', 'emphasizedRegions']) {
    for (const m of exercise[source] ?? []) {
      if (m.name) muscles.add(m.name);
    }
  }
  return [...muscles];
}

/**
 * summarizeSession(session) — normaliza uma sessão bruta em formato padronizado.
 * Reimplementada idêntica ao index.html linhas 496–547.
 */
function summarizeSession(session) {
  const exercises = (session.workoutSessionExercises ?? []).map(ex => ({
    name: ex.exercise?.name ?? '(unknown)',
    muscles: extractMuscles(ex.exercise ?? {}),
    sets: (ex.workoutSessionSets ?? []).filter(s => s.isComplete).map(s => ({
      weight: toNumber(s.weight),
      reps: toNumber(s.reps),
      oneRepMax: toNumber(s.oneRepMax),
    })),
  }));

  const volume = exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s2, set) => s2 + set.weight * set.reps, 0), 0);

  const setCount = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return {
    id: session.id,
    name: session.name,
    date: session.startDate,
    exercises,
    volume,
    setCount,
    exerciseCount: exercises.length,
  };
}

/* ─── Fixture real ─────────────────────────────────────────────── */

const realSessions = JSON.parse(
  readFileSync(resolve(root, 'data/WorkoutSession.json'), 'utf8')
);

/* ─── Testes: toNumber ─────────────────────────────────────────── */

describe('toNumber', () => {
  it('retorna número intacto', () => {
    assert.equal(toNumber(42), 42);
    assert.equal(toNumber(0), 0);
    assert.equal(toNumber(-3.5), -3.5);
  });

  it('coage string numérica para número', () => {
    assert.equal(toNumber('12'), 12);
    assert.equal(toNumber('30.5'), 30.5);
    assert.equal(toNumber('0'), 0);
  });

  it('retorna 0 para NaN / null / undefined', () => {
    assert.equal(toNumber(null), 0);
    assert.equal(toNumber(undefined), 0);
    assert.equal(toNumber(''), 0);
  });

  it('retorna 0 para string não-numérica', () => {
    assert.equal(toNumber('abc'), 0);
    assert.equal(toNumber('-'), 0);
    assert.equal(toNumber('N/A'), 0);
  });
});

/* ─── Testes: extractMuscles ───────────────────────────────────── */

describe('extractMuscles', () => {
  const exFixture = {
    primaryMuscleGroups: [{ name: 'Chest' }, { name: 'Front Delts' }],
    secondaryMuscleGroups: [{ name: 'Triceps' }],
    emphasizedRegions: [],
  };

  it('coleta primary + secondary', () => {
    const result = extractMuscles(exFixture);
    assert.ok(result.includes('Chest'));
    assert.ok(result.includes('Triceps'));
    assert.ok(result.includes('Front Delts'));
  });

  it('deduplica musculos repetidos', () => {
    const result = extractMuscles({
      primaryMuscleGroups: [{ name: 'Chest' }],
      secondaryMuscleGroups: [{ name: 'Chest' }],
      emphasizedRegions: [{ name: 'Chest' }],
    });
    assert.equal(result.filter(m => m === 'Chest').length, 1);
  });

  it('retorna [] quando todos campos ausentes', () => {
    const result = extractMuscles({});
    assert.deepEqual(result, []);
  });

  it('ignora entries sem name', () => {
    const result = extractMuscles({
      primaryMuscleGroups: [{ name: 'Chest' }, { id: 'no-name' }],
      secondaryMuscleGroups: [{ name: 'Chest' }, {}],
      emphasizedRegions: [],
    });
    // Set já deduplica 'Chest' e ignora o sem name
    assert.deepEqual(result, ['Chest']);
  });
});

/* ─── Testes: summarizeSession ─────────────────────────────────── */

describe('summarizeSession', () => {
  it('extrai campos básicos', () => {
    const fake = {
      id: 'test-001',
      name: 'Treino Teste',
      startDate: '2026-01-01T10:00:00Z',
      workoutSessionExercises: [],
    };
    const result = summarizeSession(fake);
    assert.equal(result.id, 'test-001');
    assert.equal(result.name, 'Treino Teste');
    assert.equal(result.date, '2026-01-01T10:00:00Z');
    assert.equal(result.volume, 0);
    assert.equal(result.setCount, 0);
    assert.equal(result.exerciseCount, 0);
  });

  it('calcula volume (weight × reps)', () => {
    const fake = {
      id: 'test-002',
      name: 'A',
      startDate: '2026-01-01T10:00:00Z',
      workoutSessionExercises: [{
        exercise: {
          name: 'Supino',
          primaryMuscleGroups: [{ name: 'Chest' }],
          secondaryMuscleGroups: [],
          emphasizedRegions: [],
        },
        workoutSessionSets: [
          { isComplete: true, weight: 60, reps: 10, oneRepMax: 80 },
          { isComplete: true, weight: 70, reps: 8, oneRepMax: 90 },
        ],
      }],
    };
    const result = summarizeSession(fake);
    // 60×10 + 70×8 = 600 + 560 = 1160
    assert.equal(result.volume, 1160);
    assert.equal(result.setCount, 2);
    assert.equal(result.exerciseCount, 1);
  });

  it('ignora sets não concluídos', () => {
    const fake = {
      id: 'test-003',
      name: 'B',
      startDate: '2026-01-01T10:00:00Z',
      workoutSessionExercises: [{
        exercise: { name: 'Agachamento', primaryMuscleGroups: [], secondaryMuscleGroups: [], emphasizedRegions: [] },
        workoutSessionSets: [
          { isComplete: true, weight: 100, reps: 5, oneRepMax: 120 },
          { isComplete: false, weight: 100, reps: 3, oneRepMax: 120 },
        ],
      }],
    };
    const result = summarizeSession(fake);
    // Apenas set concluído: 100×5 = 500
    assert.equal(result.volume, 500);
    assert.equal(result.setCount, 1);
  });

  it('trata muscleGroups ausentes (bodyweight exercises)', () => {
    const fake = {
      id: 'test-004',
      name: 'C',
      startDate: '2026-01-01T10:00:00Z',
      workoutSessionExercises: [{
        exercise: { name: 'Flexão', primaryMuscleGroups: [], secondaryMuscleGroups: [], emphasizedRegions: [] },
        workoutSessionSets: [
          { isComplete: true, reps: 15, oneRepMax: 0 },
        ],
      }],
    };
    const result = summarizeSession(fake);
    // weight ausente → 0 × 15 = 0
    assert.equal(result.volume, 0);
    assert.deepEqual(result.exercises[0].muscles, []);
  });

  it('trata workoutSessionExercises ausente', () => {
    const fake = { id: 'test-005', name: 'D', startDate: '2026-01-01T10:00:00Z' };
    const result = summarizeSession(fake);
    assert.equal(result.exerciseCount, 0);
    assert.equal(result.volume, 0);
  });

  it('trata exercise.anonymous (exercise ausente)', () => {
    const fake = {
      id: 'test-006',
      name: 'E',
      startDate: '2026-01-01T10:00:00Z',
      workoutSessionExercises: [{
        exercise: null,
        workoutSessionSets: [{ isComplete: true, weight: 50, reps: 10 }],
      }],
    };
    const result = summarizeSession(fake);
    assert.equal(result.exercises[0].name, '(unknown)');
    assert.equal(result.volume, 500);
  });
});

/* ─── Testes: dados reais ──────────────────────────────────────── */

describe('WorkoutSession.json (dados reais)', () => {
  it('141 sessões presentes incluindo Ombro de 5 de agosto', () => {
    assert.equal(realSessions.length, 141);
    const ombro = realSessions.find(s => s.name === 'Ombro' && s.startDate === 1785958040000);
    assert.ok(ombro, 'sessão Ombro de 5 de agosto deve existir');
  });

  it('todas as sessões têm id e startDate', () => {
    for (const s of realSessions) {
      assert.ok(s.id, `sessão sem id: ${JSON.stringify(s).slice(0, 60)}`);
      assert.ok(s.startDate, `sessão sem startDate: ${s.id}`);
    }
  });

  it('summarizeSession roda sem erro em todas as sessões', () => {
    let sumVolume = 0;
    let totalSets = 0;
    for (const s of realSessions) {
      const summary = summarizeSession(s);
      assert.ok(summary.exercises.length >= 0, `exercícios inválidos em ${s.id}`);
      assert.ok(summary.volume >= 0, `volume negativo em ${s.id}`);
      sumVolume += summary.volume;
      totalSets += summary.setCount;
    }
    // Soma do volume total deve ser positiva (tem treinos)
    assert.ok(sumVolume > 0, 'volume total deve ser > 0');
    assert.ok(totalSets > 0, 'total de sets deve ser > 0');
  });

  it('extractMuscles não retorna musculos vazios', () => {
    const allMuscles = new Set();
    for (const s of realSessions) {
      for (const ex of (s.workoutSessionExercises ?? [])) {
        for (const m of extractMuscles(ex.exercise ?? {})) {
          allMuscles.add(m);
        }
      }
    }
    assert.ok(allMuscles.size > 0, 'deve haver pelo menos 1 grupo muscular');
    assert.ok(allMuscles.has('Chest') || allMuscles.has('Back') || allMuscles.has('Legs'),
      'deve conter Chest, Back ou Legs');
  });
});
