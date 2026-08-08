import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const html = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8');

describe('hero enxuto', () => {
  it('não contém branding pessoal, subtítulo ou botões de exportar e compartilhar', () => {
    assert.equal(html.includes('Evolução de William'), false);
    assert.equal(html.includes('id="heroStatus"'), false);
    assert.equal(html.includes('id="exportBtn"'), false);
    assert.equal(html.includes('id="shareBtn"'), false);
  });

  it('mantém metadados do último treino e atualização', () => {
    assert.equal(html.includes('id="lastWorkout"'), true);
    assert.equal(html.includes('id="updatedAt"'), true);
  });
});
