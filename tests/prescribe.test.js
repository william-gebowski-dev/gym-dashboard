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

  it('arredonda o incremento em vez de devolver lixo de ponto flutuante', () => {
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Rosca', [serie(20.1, 10)]),
      sessao('2026-01-08T10:00:00Z', 'Rosca', [serie(20.3, 10)]),
    ];
    assert.equal(P.usualIncrement(s, 'Rosca'), 0.2);
  });

  it('não confunde dois blocos do mesmo exercício na MESMA sessão com progressão', () => {
    // Caso real: sessão de 2025-07-16 tem "Remada cavalinho na máquina" duas
    // vezes. Sem agregar por dia, a diferença entre os blocos virava incremento.
    const s = [
      sessao('2026-01-01T10:00:00Z', 'Remada', [serie(50, 10)]),
      {
        id: 's-dupla',
        startDate: '2026-01-08T10:00:00Z',
        workoutSessionExercises: [
          { exercise: { name: 'Remada' }, workoutSessionSets: [serie(40, 12)] },
          { exercise: { name: 'Remada' }, workoutSessionSets: [serie(60, 12)] },
        ],
      },
    ];
    // A carga do dia foi 60, então o incremento é 60 − 50. Agregando por
    // entrada em vez de por dia, sairia 20 (a diferença entre os dois blocos).
    assert.equal(P.usualIncrement(s, 'Remada'), 10);
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

  it('no ramo stale nada é sugerido: peso, reps e incremento vêm nulos', () => {
    const s = [
      sessao('2024-06-01T10:00:00Z', 'Supino', [serie(50, 12)]),
      sessao('2025-01-01T10:00:00Z', 'Supino', [serie(55, 12)]),
    ];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'stale');
    assert.equal(r.suggestedWeight, null);
    assert.equal(r.targetReps, null);
    assert.equal(r.increment, null);
    assert.equal(r.lastReps, 12);
  });

  it('fixa a fronteira dos 180 dias: 180 ainda sugere, 181 é stale', () => {
    const naFronteira = [sessao('2026-02-11T10:00:00Z', 'Supino', [serie(55, 12)])];
    const rDentro = P.suggest(naFronteira, 'Supino', agora);
    assert.equal(rDentro.daysSince, 180);
    assert.equal(rDentro.status, 'raise');

    const passouUmDia = [sessao('2026-02-10T10:00:00Z', 'Supino', [serie(55, 12)])];
    const rFora = P.suggest(passouUmDia, 'Supino', agora);
    assert.equal(rFora.daysSince, 181);
    assert.equal(rFora.status, 'stale');
  });

  it('data no futuro não vira sugestão: degrada para stale', () => {
    const s = [sessao('2026-09-01T10:00:00Z', 'Supino', [serie(55, 12)])];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'stale');
    assert.ok(r.daysSince < 0);
    assert.equal(r.suggestedWeight, null);
  });

  it('lastDate é a data da última sessão do exercício', () => {
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-08-08T10:00:00Z', 'Supino', [serie(55, 10)]),
      sessao('2026-08-09T10:00:00Z', 'Agachamento', [serie(100, 10)]),
    ];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.lastDate.toISOString(), '2026-08-08T10:00:00.000Z');
    assert.equal(r.daysSince, 2);
  });

  it('conta o dia em UTC, não no fuso de quem roda o código', () => {
    // 23:00Z e 01:00Z do dia seguinte são 1 dia de diferença em UTC. Num fuso a
    // leste (Tóquio) ou a oeste (Kiritimati/Honolulu) a meia-noite LOCAL cai no
    // meio desse intervalo e a conta escorregaria para 0 ou 2.
    const s = [sessao('2026-08-09T23:00:00Z', 'Supino', [serie(55, 10)])];
    const r = P.suggest(s, 'Supino', new Date('2026-08-10T01:00:00Z'));
    assert.equal(r.daysSince, 1);
  });

  it('agrega os dois blocos do mesmo exercício na mesma sessão', () => {
    const s = [{
      id: 's-dupla',
      startDate: '2026-08-08T10:00:00Z',
      workoutSessionExercises: [
        { exercise: { name: 'Remada' }, workoutSessionSets: [serie(60, 12)] },
        { exercise: { name: 'Remada' }, workoutSessionSets: [serie(40, 12)] },
      ],
    }];
    // A carga do dia foi 60, não a do último bloco registrado.
    assert.equal(P.suggest(s, 'Remada', agora).lastWeight, 60);
  });

  it('cada série é medida contra o próprio topo de faixa', () => {
    // A segunda série tem topo 12 e fez 10: não bateu o próprio topo. Usar a
    // faixa da primeira série (6–10) para as duas faria subir a carga à toa.
    const s = [sessao('2026-08-08T10:00:00Z', 'Supino', [serie(50, 10, 6, 10), serie(50, 10, 8, 12)])];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'hold');
    assert.equal(r.suggestedWeight, 50);
    assert.equal(r.targetReps, 11);
  });

  it('faixa zerada não conta como faixa: cai no padrão 8–12', () => {
    const zerada = { isComplete: true, warmUp: false, weight: 50, reps: 10, minReps: 0, maxReps: 0 };
    const r = P.suggest([sessao('2026-08-08T10:00:00Z', 'Supino', [zerada])], 'Supino', agora);
    assert.equal(r.status, 'hold');
    assert.equal(r.targetReps, 11);
  });
});

describe('suggest — teto de 10% no incremento', () => {
  it('incremento dentro do teto sugere normalmente', () => {
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Supino', [serie(50, 10)]),
      sessao('2026-08-08T10:00:00Z', 'Supino', [serie(52, 12)]),
    ];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.status, 'raise');
    assert.equal(r.increment, 2);
    assert.equal(r.suggestedWeight, 54);
  });

  it('incremento acima de 10% da carga não vira sugestão: status nosafe', () => {
    // Caso real da "Panturrilha no leg press": menor incremento registrado 20 kg
    // sobre 80 kg seria +25% num treino só.
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Panturrilha', [serie(60, 10)]),
      sessao('2026-08-08T10:00:00Z', 'Panturrilha', [serie(80, 12)]),
    ];
    const r = P.suggest(s, 'Panturrilha', agora);
    assert.equal(r.status, 'nosafe');
    assert.equal(r.suggestedWeight, null);
    assert.equal(r.targetReps, null);
    assert.equal(r.increment, 20);
    assert.equal(r.lastWeight, 80);
    assert.equal(r.lastReps, 12);
    assert.equal(r.daysSince, 2);
  });

  it('na fronteira exata, incremento igual a 10% da carga ainda sugere', () => {
    const s = [
      sessao('2026-08-01T10:00:00Z', 'Supino', [serie(45, 10)]),
      sessao('2026-08-08T10:00:00Z', 'Supino', [serie(50, 12)]),
    ];
    const r = P.suggest(s, 'Supino', agora);
    assert.equal(r.increment, 5);
    assert.equal(r.status, 'raise');
    assert.equal(r.suggestedWeight, 55);
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
