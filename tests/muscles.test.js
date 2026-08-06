/**
 * tests/muscles.test.js — Recência por grupo muscular
 *
 * js/muscles.js atacha em `window`, então carregamos via eval num window
 * simulado, igual a tests/pure-fns.test.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

globalThis.window = globalThis;
eval(readFileSync(resolve(root, 'js/muscles.js'), 'utf8'));
const M = globalThis.Muscles;
assert.ok(M, 'window.Muscles não exportou');

const sessao = (startDate, exercicios) => ({
  id: `s-${startDate}`,
  startDate,
  workoutSessionExercises: exercicios,
});
const exercicio = (name, grupos) => ({
  exercise: { name, primaryMuscleGroups: grupos.map(g => ({ name: g })) },
  workoutSessionSets: [{ isComplete: true, weight: 50, reps: 10 }],
});

describe('recencyByGroup', () => {
  const agora = new Date('2026-08-10T12:00:00Z');

  it('ordena do mais atrasado para o mais recente', () => {
    const r = M.recencyByGroup([
      sessao('2026-08-08T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
      sessao('2026-06-10T10:00:00Z', [exercicio('Supino', ['Chest'])]),
    ], agora);
    assert.equal(r[0].group, 'Chest');
    assert.equal(r[1].group, 'Lats');
  });

  it('calcula daysSince em dias de calendário', () => {
    const r = M.recencyByGroup(
      [sessao('2026-08-08T22:00:00Z', [exercicio('Puxada', ['Lats'])])],
      agora,
    );
    assert.equal(r[0].daysSince, 2);
  });

  it('usa a sessão MAIS RECENTE quando o grupo aparece várias vezes', () => {
    const r = M.recencyByGroup([
      sessao('2026-01-01T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
      sessao('2026-08-09T10:00:00Z', [exercicio('Remada', ['Lats'])]),
    ], agora);
    assert.equal(r.length, 1);
    assert.equal(r[0].daysSince, 1);
  });

  it('lista exercícios do grupo por frequência decrescente', () => {
    const r = M.recencyByGroup([
      sessao('2026-08-01T10:00:00Z', [exercicio('Remada', ['Lats'])]),
      sessao('2026-08-02T10:00:00Z', [exercicio('Remada', ['Lats'])]),
      sessao('2026-08-03T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
    ], agora);
    assert.deepEqual(r[0].exercises, ['Remada', 'Puxada']);
  });

  it('um exercício com dois grupos conta para os dois', () => {
    const r = M.recencyByGroup(
      [sessao('2026-08-09T10:00:00Z', [exercicio('Supino', ['Chest', 'Triceps'])])],
      agora,
    );
    assert.deepEqual(r.map(x => x.group).sort(), ['Chest', 'Triceps']);
  });

  it('exercício sem grupo muscular não quebra e não vira grupo', () => {
    const semGrupo = { exercise: { name: 'Alongamento' }, workoutSessionSets: [] };
    const r = M.recencyByGroup(
      [sessao('2026-08-09T10:00:00Z', [semGrupo, exercicio('Puxada', ['Lats'])])],
      agora,
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].group, 'Lats');
  });

  it('conta dias em UTC, não no fuso local', () => {
    // 22:00Z é o caso que motiva a convenção UTC do repo: em fuso local a leste
    // esse instante vira o dia seguinte e daysSince cairia para 1.
    const r = M.recencyByGroup(
      [sessao('2026-08-08T22:00:00Z', [exercicio('Puxada', ['Lats'])])],
      agora,
    );
    assert.equal(r[0].daysSince, 2);
  });

  it('expõe lastDate como Date da sessão mais recente do grupo', () => {
    const r = M.recencyByGroup([
      sessao('2026-08-03T10:00:00Z', [exercicio('Remada', ['Lats'])]),
      sessao('2026-08-07T15:30:00Z', [exercicio('Puxada', ['Lats'])]),
      sessao('2026-08-05T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
    ], agora);
    assert.ok(r[0].lastDate instanceof Date);
    assert.equal(r[0].lastDate.toISOString(), '2026-08-07T15:30:00.000Z');
  });

  it('exercícios de mesma frequência desempatam por ordem alfabética', () => {
    const r = M.recencyByGroup([
      sessao('2026-08-01T10:00:00Z', [exercicio('Remada', ['Lats'])]),
      sessao('2026-08-02T10:00:00Z', [exercicio('Puxada', ['Lats'])]),
    ], agora);
    assert.deepEqual(r[0].exercises, ['Puxada', 'Remada']);
  });

  it('grupos com o mesmo daysSince desempatam por ordem alfabética', () => {
    const r = M.recencyByGroup(
      [sessao('2026-08-05T10:00:00Z', [
        exercicio('Rosca', ['Biceps']),
        exercicio('Supino', ['Chest']),
        exercicio('Agachamento', ['Adductors']),
      ])],
      agora,
    );
    assert.deepEqual(r.map(x => x.group), ['Adductors', 'Biceps', 'Chest']);
    assert.deepEqual(r.map(x => x.daysSince), [5, 5, 5]);
  });

  it('lista vazia devolve array vazio', () => {
    assert.deepEqual(M.recencyByGroup([], agora), []);
    assert.deepEqual(M.recencyByGroup(null, agora), []);
  });
});
