import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
globalThis.window = globalThis;
eval(readFileSync(resolve(__dirname, '..', 'js/dashboard-insights.js'), 'utf8'));
const I = globalThis.DashboardInsights;

describe('buildDashboardSnapshot', () => {
  const sessions = [
    { id: 'a', name: 'Costas', date: new Date('2026-08-01T12:00:00Z'), volume: 900, sets: 12, exercises: 4, durationMin: 45 },
    { id: 'b', name: 'Peito', date: new Date('2026-08-04T12:00:00Z'), volume: 1100, sets: 16, exercises: 5, durationMin: 50 },
    { id: 'c', name: 'Ombro', date: new Date('2026-08-05T12:00:00Z'), volume: 1308, sets: 16, exercises: 4, durationMin: 40 },
  ];

  it('cria snapshot semanal, próxima ação e linha do tempo recente', () => {
    const result = I.buildDashboardSnapshot(sessions, new Date('2026-08-08T12:00:00Z'));
    assert.equal(result.latest.name, 'Ombro');
    assert.equal(result.week.sessions, 2);
    assert.equal(result.week.volume, 2408);
    assert.equal(result.nextAction, 'Costas');
    assert.deepEqual(result.timeline.map(s => s.id), ['c', 'b', 'a']);
  });

  it('não inventa próxima ação sem sessões', () => {
    const result = I.buildDashboardSnapshot([], new Date('2026-08-08T12:00:00Z'));
    assert.equal(result.latest, null);
    assert.equal(result.nextAction, null);
    assert.deepEqual(result.timeline, []);
  });
});
