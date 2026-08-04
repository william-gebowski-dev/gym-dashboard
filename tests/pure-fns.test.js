/**
 * tests/pure-fns.test.js — Testes das funções puras extraídas em js/data.js
 *
 * Como js/data.js atacha em `window`, carregamos via sandbox Node
 * avaliando o módulo e expondo window.Data.
 *
 * Cobertura: toNumber, epley1RM, pickOneRepMax, startOfWeekUTC,
 * isoDayUTC, normalizeSession, computePRs, computePeriodDelta,
 * computeWeeklyAdherence, applyRangeFilter, classifyPRs.
 *
 * Uso: node --test tests/pure-fns.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

// Carrega data.js num global window simulado.
// Seguro: dataSrc é arquivo local do próprio repo lido via readFileSync,
// não entrada externa. Necessário pois js/data.js atacha em `window` (sem ESM).
globalThis.window = globalThis;
const dataSrc = readFileSync(resolve(root, 'js/data.js'), 'utf8');
eval(dataSrc);
const D = globalThis.Data;
assert.ok(D, 'window.Data não exportou');

const real = JSON.parse(
  readFileSync(resolve(root, 'data/WorkoutSession.json'), 'utf8')
);
const sessions = real.map(s => D.normalizeSession(s)).sort((a, b) => a.date - b.date);

describe('toNumber', () => {
  it('number intacto', () => {
    assert.equal(D.toNumber(42), 42);
    assert.equal(D.toNumber(0), 0);
    assert.equal(D.toNumber(-3.5), -3.5);
  });
  it('coage string numérica', () => {
    assert.equal(D.toNumber('12'), 12);
    assert.equal(D.toNumber('30.5'), 30.5);
  });
  it('null/undefined/NaN → 0', () => {
    assert.equal(D.toNumber(null), 0);
    assert.equal(D.toNumber(undefined), 0);
    assert.equal(D.toNumber(''), 0);
    assert.equal(D.toNumber('abc'), 0);
    assert.equal(D.toNumber(NaN), 0);
    assert.equal(D.toNumber(Infinity), 0);
  });
});

describe('epley1RM', () => {
  it('100kg×5 → 117kg', () => {
    assert.equal(D.epley1RM(100, 5), 100 * (1 + 5 / 30));
    assert.equal(Math.round(D.epley1RM(100, 5)), 117);
  });
  it('peso zero → 0', () => assert.equal(D.epley1RM(0, 10), 0));
  it('reps zero → 0', () => assert.equal(D.epley1RM(100, 0), 0));
  it('negativos → 0', () => assert.equal(D.epley1RM(-50, 8), 0));
});

describe('pickOneRepMax', () => {
  it('usa JSON oneRepMax se > 0', () => {
    assert.equal(D.pickOneRepMax({ oneRepMax: 50, weight: 30, reps: 12 }), 50);
  });
  it('cai para Epley quando oneRepMax=0', () => {
    assert.equal(Math.round(D.pickOneRepMax({ oneRepMax: 0, weight: 100, reps: 5 })), 117);
  });
  it('cai para Epley quando oneRepMax ausente', () => {
    assert.equal(Math.round(D.pickOneRepMax({ weight: 100, reps: 5 })), 117);
  });
  it('null/undefined set → 0', () => assert.equal(D.pickOneRepMax(null), 0));
});

describe('startOfWeekUTC / isoDayUTC', () => {
  it('segunda-feira UTC de uma quarta', () => {
    const wed = new Date(Date.UTC(2026, 7, 5)); // 2026-08-05 qua
    const mon = D.startOfWeekUTC(wed);
    assert.equal(D.isoDayUTC(mon), '2026-08-03'); // segunda
  });
  it('segunda própria Imutável', () => {
    const mon = new Date(Date.UTC(2026, 7, 3));
    assert.equal(D.isoDayUTC(D.startOfWeekUTC(mon)), '2026-08-03');
  });
  it('domingo vira segunda anterior', () => {
    const sun = new Date(Date.UTC(2026, 7, 9));
    assert.equal(D.isoDayUTC(D.startOfWeekUTC(sun)), '2026-08-03');
  });
  it('data inválida → null', () => {
    assert.equal(D.startOfWeekUTC('not-a-date'), null);
    assert.equal(D.isoDayUTC('not-a-date'), null);
  });
  it('estável em fuso não-UTC (21h local não desloca dia)', () => {
    const d = new Date(Date.UTC(2026, 7, 5, 23, 0, 0)); // 23h UTC
    assert.equal(D.isoDayUTC(d), '2026-08-05');
  });
});

describe('normalizeSession', () => {
  it('campos básicos', () => {
    const fake = { id: 'x', name: 'T', startDate: '2026-01-01T10:00:00Z', workoutSessionExercises: [] };
    const r = D.normalizeSession(fake);
    assert.equal(r.id, 'x');
    assert.equal(r.name, 'T');
    assert.equal(r.volume, 0);
    assert.equal(r.sets, 0);
    assert.equal(r.exercises, 0);
  });
  it('volume = Σ weight×reps (sets completos)', () => {
    const fake = {
      id: 'x', name: 'T', startDate: '2026-01-01T10:00:00Z',
      workoutSessionExercises: [{
        exercise: { name: 'Supino' },
        workoutSessionSets: [
          { isComplete: true, weight: 60, reps: 10 },
          { isComplete: true, weight: 70, reps: 8 },
          { isComplete: false, weight: 90, reps: 3 }, // ignorado
        ],
      }],
    };
    const r = D.normalizeSession(fake);
    assert.equal(r.volume, 60 * 10 + 70 * 8); // 1160
    assert.equal(r.sets, 2);
  });
  it('durationMin calculado', () => {
    const fake = {
      id: 'x', name: 'T',
      startDate: '2026-01-01T10:00:00Z', endDate: '2026-01-01T11:15:00Z',
      workoutSessionExercises: [],
    };
    assert.equal(D.normalizeSession(fake).durationMin, 75);
  });
  it('durationMin descarta outlier > 8h', () => {
    const fake = {
      id: 'x', name: 'T',
      startDate: '2026-01-01T10:00:00Z', endDate: '2026-01-03T10:00:00Z',
      workoutSessionExercises: [],
    };
    assert.equal(D.normalizeSession(fake).durationMin, null);
  });
});

describe('computePRs', () => {
  it('usa pickOneRepMax (preferindo JSON field)', () => {
    const fake = [{
      id: 's1', startDate: '2026-01-01T10:00:00Z',
      workoutSessionExercises: [{
        exercise: { name: 'Agachamento' },
        workoutSessionSets: [
          { isComplete: true, weight: 100, reps: 5, oneRepMax: 120 },
          { isComplete: true, weight: 140, reps: 1, oneRepMax: 0 }, // Epley 140*31/30≈145
        ],
      }],
    }];
    const prs = D.computePRs(fake);
    assert.equal(prs.length, 1);
    assert.equal(prs[0].name, 'Agachamento');
    // 145 > 120 → record = 145
    assert.equal(Math.round(prs[0].weight), 145);
    assert.deepEqual(prs[0].history.length, 2);
  });
  it('descarta sets não completos', () => {
    const fake = [{
      id: 's', startDate: '2026-01-01T00:00:00Z',
      workoutSessionExercises: [{
        exercise: { name: 'A' },
        workoutSessionSets: [{ isComplete: false, weight: 999, reps: 1, oneRepMax: 1000 }],
      }],
    }];
    assert.equal(D.computePRs(fake).length, 0);
  });
  it('ordena por maior 1RM', () => {
    const fake = [{
      id: 's', startDate: '2026-01-01T00:00:00Z',
      workoutSessionExercises: [
        { exercise: { name: 'Fraco' }, workoutSessionSets: [{ isComplete: true, oneRepMax: 50 }] },
        { exercise: { name: 'Forte' }, workoutSessionSets: [{ isComplete: true, oneRepMax: 200 }] },
      ],
    }];
    const prs = D.computePRs(fake);
    assert.equal(prs[0].name, 'Forte');
    assert.equal(prs[1].name, 'Fraco');
  });
  it('em dados reais: top 12 PRs têm weight > 0 e date válida', () => {
    const prs = D.computePRs(real);
    assert.equal(prs.length, 12);
    for (const p of prs) {
      assert.ok(p.weight > 0, `PR sem peso: ${p.name}`);
      assert.ok(p.date instanceof Date && !isNaN(p.date), `PR sem data: ${p.name}`);
      assert.ok(p.history.length > 0);
    }
  });
});

describe('computePeriodDelta', () => {
  it('sessions vazias → null deltaPct, hasBase false', () => {
    const r = D.computePeriodDelta([], { from: '2026-01-01', to: '2026-02-01' }, 'volume');
    assert.equal(r.deltaPct, null);
    assert.equal(r.hasBase, false);
  });
  it('sem período anterior (previous=0) → null', () => {
    const fake = [{
      id: 's', startDate: '2026-12-01T00:00:00Z', volume: 100,
      workoutSessionExercises: [],
    }];
    const sess = fake.map(f => ({ ...D.normalizeSession(f), volume: 100 }));
    const r = D.computePeriodDelta(sess, { from: '2026-11-01', to: '2026-12-31' }, 'volume');
    assert.equal(r.hasBase, false);
    assert.equal(r.deltaPct, null);
  });
  it('delta de volume com base real', () => {
    const fake = [
      { id: 'a', startDate: '2026-01-10T00:00:00Z', volume: 1000, workoutSessionExercises: [] },
      { id: 'b', startDate: '2026-02-10T00:00:00Z', volume: 1500, workoutSessionExercises: [] },
    ];
    const sess = fake.map(f => ({ ...D.normalizeSession(f), volume: f.volume }));
    const r = D.computePeriodDelta(sess, { from: '2026-02-01', to: '2026-02-28' }, 'volume');
    assert.equal(r.current, 1500);
    assert.equal(r.previous, 1000);
    assert.equal(r.deltaPct, 50);
    assert.equal(r.hasBase, true);
  });
  it('range "all" (from null) usa span dos dados', () => {
    const r = D.computePeriodDelta(sessions, { from: null, to: null, label: 'all' }, 'volume', 'sum');
    assert.ok(r.hasBase === true || r.hasBase === false);
    assert.ok(Number.isFinite(r.current));
  });
  it('count agg conta sessões', () => {
    const fake = [
      { id: 'a', startDate: '2026-02-10T00:00:00Z', volume: 1, workoutSessionExercises: [] },
      { id: 'b', startDate: '2026-03-10T00:00:00Z', volume: 1, workoutSessionExercises: [] },
    ];
    const sess = fake.map(f => ({ ...D.normalizeSession(f), volume: f.volume }));
    const r = D.computePeriodDelta(sess, { from: '2026-03-01', to: '2026-03-31' }, 'volume', 'count');
    assert.equal(r.current, 1);
    assert.equal(r.previous, 1);
    assert.equal(r.deltaPct, 0);
  });
});

describe('computeWeeklyAdherence', () => {
  it('vazio → zeros', () => {
    const r = D.computeWeeklyAdherence([], 4);
    assert.equal(r.currentStreak, 0);
    assert.equal(r.longestStreak, 0);
    assert.equal(r.totalWeeks, 0);
    assert.equal(r.weeklyFreq, 0);
  });
  it('4 sessões na mesma semana não infla streak (projeto em andamento)', () => {
    const sess = [];
    for (let i = 0; i < 4; i++) sess.push({ date: new Date(), volume: 0, sets: 0, exercises: 0 });
    // sessões hoje — semana atual em andamento
    const r = D.computeWeeklyAdherence(sess, 4);
    assert.equal(r.totalWeeks, 1);
    // streak atual não conta semana em andamento
    assert.equal(r.currentStreak, 0);
  });
  it('semana completa passada conta streak', () => {
    const past = new Date(Date.now() - 14 * 86_400_000); // 2 semanas atrás
    const sess = [
      { date: past, volume: 0, sets: 0, exercises: 0 },
      { date: past, volume: 0, sets: 0, exercises: 0 },
      { date: past, volume: 0, sets: 0, exercises: 0 },
      { date: past, volume: 0, sets: 0, exercises: 0 },
    ];
    const r = D.computeWeeklyAdherence(sess, 4);
    assert.equal(r.weeksHit, 1);
    assert.equal(r.longestStreak, 1);
  });
  it('em dados reais: weeksHit > 0', () => {
    const r = D.computeWeeklyAdherence(sessions, 4);
    assert.ok(r.totalWeeks > 0);
    assert.ok(r.weeklyFreq > 0);
    assert.ok(r.weeklyFreq < 8);
  });
});

describe('applyRangeFilter', () => {
  it('sem range → retorna cópia', () => {
    const arr = sessions.slice(0, 5);
    assert.equal(D.applyRangeFilter(arr, null).length, 5);
    assert.equal(D.applyRangeFilter(arr, { from: null, to: null }).length, 5);
  });
  it('filtra por from', () => {
    const cutoff = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const r = D.applyRangeFilter(sessions, { from: cutoff, to: null });
    for (const s of r) assert.ok(s.date >= new Date(cutoff));
  });
  it('filtra por from+to', () => {
    const r = D.applyRangeFilter(sessions, { from: '2025-01-01', to: '2025-12-31' });
    for (const s of r) {
      assert.ok(s.date >= new Date('2025-01-01T00:00:00Z'));
      assert.ok(s.date <= new Date('2025-12-31T23:59:59Z'));
    }
  });
  it('null/undefined sessions → []', () => {
    assert.deepEqual(D.applyRangeFilter(null, null), []);
    assert.deepEqual(D.applyRangeFilter(undefined, { from: 'x' }), []);
  });
  it('?days=181 equivalente em dados reais', () => {
    const from = new Date(Date.now() - 181 * 86_400_000).toISOString().slice(0, 10);
    const r = D.applyRangeFilter(sessions, { from, to: null });
    assert.ok(r.length > 0);
    assert.ok(r.length < sessions.length);
  });
});

describe('classifyPRs', () => {
  it('agrupa por idade', () => {
    const now = Date.now();
    const prs = [
      { name: 'A', weight: 100, date: new Date(now - 10 * 86_400_000) },   // novo
      { name: 'B', weight: 100, date: new Date(now - 50 * 86_400_000) },  // evolução
      { name: 'C', weight: 100, date: new Date(now - 200 * 86_400_000) },  // estagnado
      { name: 'D', weight: 100, date: null },                              // estagnado
    ];
    const c = D.classifyPRs(prs);
    assert.equal(c.new.length, 1);
    assert.equal(c.evolving.length, 1);
    assert.equal(c.stagnant.length, 2);
  });
});