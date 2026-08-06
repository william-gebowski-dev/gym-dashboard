/**
 * tests/prescribe.test.js — Regra de dupla progressão
 *
 * A regra não foi inventada: 80% das séries do dataset têm faixa de repetições
 * explícita (8–12 em praticamente todas) e os incrementos de carga realmente
 * usados são +5, +1, +2 e +10 kg. O teste cobre o contrato dessa regra.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

globalThis.window = globalThis;
eval(readFileSync(resolve(root, 'js/prescribe.js'), 'utf8'));
const P = globalThis.Prescribe;
assert.ok(P, 'window.Prescribe não exportou');

const serie = (weight, reps, minReps = 8, maxReps = 12) => ({
  isComplete: true, warmUp: false, weight, reps, minReps, maxReps,
});
const sessao = (startDate, nome, sets) => ({
  id: `s-${startDate}`,
  startDate,
  workoutSessionExercises: [{ exercise: { name: nome }, workoutSessionSets: sets }],
});

const agora = new Date('2026-08-10T12:00:00Z');

describe('usualIncrement', () => {
  it('usa o MENOR incremento positivo já aplicado no exercício', () => {
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-01-08T10:00:00Z', 'Supino', [serie(55, 10)]),
      sessao('2026-01-15T10:00:00Z', 'Supino', [serie(57, 10)]),
    ];
    assert.equal(P.usualIncrement(s, 'Supino'), 2);
  });

  it('cai para 2.5 quando o exercício nunca subiu de carga', () => {
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-01-08T10:00:00Z', 'Supino', [serie(50, 10)]),
    ];
    assert.equal(P.usualIncrement(s, 'Supino'), 2.5);
  });

  it('ignora o histórico de outros exercícios', () => {
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Agachamento', [serie(100, 10)]),
      sessao('2026-01-08T10:00:00Z', 'Agachamento', [serie(110, 10)]),
    ];
    assert.equal(P.usualIncrement(s, 'Supino'), 2.5);
  });
});

describe('suggest', () => {
  it('bateu o topo da faixa em todas as séries → sobe a carga e volta ao piso', () => {
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-08-08T10:00:00Z', 'Supino', [serie(55, 12), serie(55, 12)]),
    ];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'raise');
    assert.equal(r.lastWeight, 55);
    assert.equal(r.increment, 5);
    assert.equal(r.suggestedWeight, 60);
    assert.equal(r.targetReps, 8);
  });

  it('uma série abaixo do topo → mantém a carga e mira uma repetição a mais', () => {
    const s = [sessao('2026-08-08T10:00:00Z', 'Supino', [serie(55, 12), serie(55, 10)])];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'hold');
    assert.equal(r.suggestedWeight, 55);
    assert.equal(r.targetReps, 11);
  });

  it('sem faixa registrada assume 8–12', () => {
    const semFaixa = { isComplete: true, warmUp: false, weight: 40, reps: 12 };
    const r = P.suggest([sessao('2026-08-08T10:00:00Z', 'Rosca', [semFaixa])], 'Rosca', agora);
    assert.equal(r.status, 'raise');
    assert.equal(r.targetReps, 8);
  });

  it('lacuna maior que 180 dias → status stale, sem sugestão de carga', () => {
    const s = [sessao('2025-01-01T10:00:00Z', 'Supino', [serie(55, 12)])];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'stale');
    assert.equal(r.suggestedWeight, null);
    assert.ok(r.daysSince > 180);
    assert.equal(r.lastWeight, 55);
  });

  it('exercício que nunca apareceu devolve null', () => {
    assert.equal(P.suggest([], 'Supino', agora), null);
    assert.equal(P.suggest(null, 'Supino', agora), null);
  });

  it('ignora aquecimento e séries incompletas', () => {
    const aquecimento = { isComplete: true, warmUp: true, weight: 20, reps: 15, minReps: 8, maxReps: 12 };
    const incompleta = { isComplete: false, warmUp: false, weight: 90, reps: 3, minReps: 8, maxReps: 12 };
    const r = P.suggest(
      [sessao('2026-08-08T10:00:00Z', 'Supino', [aquecimento, incompleta, serie(55, 12)])],
      'Supino', agora,
    );
    assert.equal(r.lastWeight, 55);
    assert.equal(r.status, 'raise');
  });

  it('usa apenas a ÚLTIMA sessão do exercício para decidir', () => {
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Supino', [serie(55, 12)]),
      sessao('2026-08-08T10:00:00Z', 'Supino', [serie(55, 9)]),
    ];
    assert.equal(P.suggest(s, 'Supino', agora).status, 'hold');
  });
});
