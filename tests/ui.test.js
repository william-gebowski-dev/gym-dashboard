/**
 * tests/ui.test.js — Testes de js/ui.js
 *
 * ui.js depende de `document` (DOM). Como js/ui.js atacha em `window`,
 * carregamos via eval e mockamos `document` com um fake mínimo
 * (apenas createElement, className, textContent, append).
 *
 * Cobertura: escapeHtml, kpiCard, prBadge, summaryCard, spanText,
 * spanStrong, prCard.
 *
 * Uso: node --test tests/ui.test.js
 *
 * SAFETY: `eval(uiSrc)` é usado aqui propositadamente. O conteúdo é
 * lido do próprio repo via `readFileSync` (não entrada externa), e
 * js/ui.js é IIFE vanilla sem ESM. Padrão idêntico em tests/pure-fns.test.js
 * e tests/state.test.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

// Mock mínimo de DOM: só o que js/ui.js usa.
class FakeNode {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.className = '';
    this.textContent = '';
    this.attrs = {};
    this.dataset = {};
    this.title = '';
  }
  append(...nodes) {
    for (const n of nodes) this.children.push(n);
    return this;
  }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  contains(node) {
    if (node === this) return true;
    return this.children.some(c => c === node || c.contains?.(node));
  }
  // serializa para inspeção
  toString() {
    const text = this.textContent || '';
    const childStr = this.children.map(c => c.toString()).join('');
    return `<${this.tagName.toLowerCase()}${this.className ? ` class="${this.className}"` : ''}>${text}${childStr}</${this.tagName.toLowerCase()}>`;
  }
  // collect de textContent recursivo
  get fullText() {
    const own = this.textContent || '';
    return own + this.children.map(c => c.fullText || '').join('');
  }
}

globalThis.window = globalThis;
globalThis.document = {
  createElement(tag) { return new FakeNode(tag); },
};

const uiSrc = readFileSync(resolve(root, 'js/ui.js'), 'utf8');
eval(uiSrc);
const U = globalThis.UI;
assert.ok(U, 'window.UI não exportou');

describe('escapeHtml', () => {
  it('escapa <, >, &, ", \'', () => {
    assert.equal(U.escapeHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
  it('null/undefined → string vazia', () => {
    assert.equal(U.escapeHtml(null), '');
    assert.equal(U.escapeHtml(undefined), '');
  });
  it('números são convertidos para string', () => {
    assert.equal(U.escapeHtml(42), '42');
  });
  it('texto sem caracteres perigosos passa intacto', () => {
    assert.equal(U.escapeHtml('Treino normal'), 'Treino normal');
  });
  it('ordem dos replaces: & primeiro (evita double-escape)', () => {
    // Se & fosse escapado por último, o &amp; de &lt; viraria &amp;amp;.
    assert.equal(U.escapeHtml('&lt;'), '&amp;lt;');
  });
});

describe('spanText / spanStrong', () => {
  it('spanText retorna span com textContent correto', () => {
    const s = U.spanText('olá');
    assert.equal(s.tagName, 'SPAN');
    assert.equal(s.textContent, 'olá');
  });
  it('spanStrong envolve text em <strong>', () => {
    const s = U.spanStrong('forte');
    assert.equal(s.tagName, 'SPAN');
    assert.equal(s.children.length, 1);
    assert.equal(s.children[0].tagName, 'STRONG');
    assert.equal(s.children[0].textContent, 'forte');
  });
});

describe('summaryCard', () => {
  it('cria div.summary-card com textContent', () => {
    const c = U.summaryCard('Resumo do dia');
    assert.equal(c.tagName, 'DIV');
    assert.equal(c.className, 'summary-card');
    assert.equal(c.textContent, 'Resumo do dia');
  });
});

describe('kpiCard', () => {
  it('renderiza value + label', () => {
    const c = U.kpiCard('42', 'Sessões');
    assert.equal(c.className, 'kpi');
    assert.equal(c.fullText.includes('42'), true);
    assert.equal(c.fullText.includes('Sessões'), true);
  });
  it('adiciona delta quando pct é número', () => {
    const c = U.kpiCard('100', 'Volume', { pct: 50, direction: 'up' });
    assert.equal(c.fullText.includes('↑'), true);
    assert.equal(c.fullText.includes('50%'), true);
  });
  it('ignora delta quando pct não é número', () => {
    const c = U.kpiCard('100', 'Volume', { pct: 'lixo' });
    assert.equal(c.fullText.includes('%'), false);
  });
  it('direction down → seta ↓', () => {
    const c = U.kpiCard('0', 'X', { pct: 10, direction: 'down' });
    assert.equal(c.fullText.includes('↓'), true);
  });
  it('direction flat → igual =', () => {
    const c = U.kpiCard('0', 'X', { pct: 0, direction: 'flat' });
    assert.equal(c.fullText.includes('='), true);
  });
});

describe('prBadge', () => {
  it('status "new" → "NOVO"', () => {
    const b = U.prBadge('new');
    assert.equal(b.className.includes('new'), true);
    assert.equal(b.textContent, 'NOVO');
  });
  it('status "evolving" → "EM EVOLUÇÃO"', () => {
    assert.equal(U.prBadge('evolving').textContent, 'EM EVOLUÇÃO');
  });
  it('status "stagnant" → "ESTAGNADO"', () => {
    assert.equal(U.prBadge('stagnant').textContent, 'ESTAGNADO');
  });
  it('status desconhecido → usa o próprio status como label', () => {
    assert.equal(U.prBadge('mystery').textContent, 'mystery');
  });
});

describe('prCard', () => {
  it('renderiza name em div.pr-name', () => {
    const c = U.prCard({ name: 'Supino', weight: 100, date: new Date(), history: [] });
    assert.equal(c.className, 'pr-card');
    let name;
    for (const ch of c.children) {
      if (ch.className === 'pr-name') { name = ch; break; }
    }
    assert.ok(name, 'div.pr-name não encontrada');
    assert.equal(name.textContent, 'Supino');
    assert.equal(name.title, 'Supino');
  });
  it('renderiza weight formatado', () => {
    const c = U.prCard({ name: 'A', weight: 100.4, history: [] });
    let weight;
    for (const ch of c.children) {
      if (ch.className === 'pr-weight') { weight = ch; break; }
    }
    assert.ok(weight);
    assert.equal(weight.textContent, '100 kg');
  });
});
