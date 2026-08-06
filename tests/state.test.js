/**
 * tests/state.test.js — Testes de js/state.js
 *
 * State depende de `window` (URL, localStorage, history). Como js/state.js
 * atacha em `window`, carregamos via eval e expomos window.State.
 *
 * Cobertura: daysAgoISO, parseRangeFromURL, parseTabFromURL, applyRange.
 *
 * Uso: node --test tests/state.test.js
 *
 * SAFETY: `eval(stateSrc)` é usado aqui propositadamente. O conteúdo é
 * lido do próprio repo via `readFileSync` (não entrada externa), e
 * js/state.js é IIFE vanilla sem ESM. Alternativas (vm.Module, child
 * process) trariam complexidade sem ganho real de segurança neste
 * contexto. Padrão idêntico em tests/pure-fns.test.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

// Polyfills mínimos para state.js rodar em Node puro.
const urlStore = new Map();
globalThis.window = globalThis;
globalThis.URL = class FakeURL {
  constructor(href) {
    if (href instanceof FakeURL) {
      this._params = new Map(href._params);
      this._href = href._href;
    } else {
      const [base, qs = ''] = String(href).split('?');
      this._href = base;
      this._params = new Map();
      for (const pair of qs.split('&')) {
        if (!pair) continue;
        const [k, v = ''] = pair.split('=');
        this._params.set(k, decodeURIComponent(v));
      }
    }
  }
  get searchParams() {
    const self = this;
    return {
      get(k) { return self._params.has(k) ? self._params.get(k) : null; },
      set(k, v) { self._params.set(k, String(v)); },
      delete(k) { self._params.delete(k); },
      has(k) { return self._params.has(k); },
      toString() {
        if (self._params.size === 0) return '';
        return '?' + [...self._params.entries()].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      },
    };
  }
  toString() { return this._href + this.searchParams.toString(); }
};
globalThis.location = {
  get href() { return urlStore.get('href') ?? 'http://localhost/'; },
  set href(v) { urlStore.set('href', v); },
  get search() { return new URL(urlStore.get('href') ?? 'http://localhost/').searchParams.toString() || ''; },
};
globalThis.history = { replaceState(_state, _title, url) { if (url) urlStore.set('href', url); } };
const lsStore = new Map();
globalThis.localStorage = {
  getItem(k) { return lsStore.has(k) ? lsStore.get(k) : null; },
  setItem(k, v) { lsStore.set(k, String(v)); },
  removeItem(k) { lsStore.delete(k); },
  clear() { lsStore.clear(); },
};

const stateSrc = readFileSync(resolve(root, 'js/state.js'), 'utf8');
eval(stateSrc);
const S = globalThis.State;
assert.ok(S, 'window.State não exportou');

describe('daysAgoISO', () => {
  it('hoje (n=0) → YYYY-MM-DD de hoje UTC', () => {
    const expected = new Date().toISOString().slice(0, 10);
    assert.equal(S.daysAgoISO(0), expected);
  });
  it('n=7 → 7 dias atrás UTC', () => {
    const expected = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    assert.equal(S.daysAgoISO(7), expected);
  });
  it('retorna string com exatamente 10 chars (YYYY-MM-DD)', () => {
    assert.equal(S.daysAgoISO(30).length, 10);
  });
});

describe('parseRangeFromURL', () => {
  it('sem params → { from: null, to: null, label: "all" }', () => {
    urlStore.set('href', 'http://localhost/');
    const r = S.parseRangeFromURL();
    assert.equal(r.from, null);
    assert.equal(r.to, null);
    assert.equal(r.label, 'all');
  });
  it('?days=30 → label "30d" e from = 30 dias atrás', () => {
    urlStore.set('href', 'http://localhost/?days=30');
    const r = S.parseRangeFromURL();
    assert.equal(r.label, '30d');
    assert.equal(S.daysAgoISO(30), r.from);
  });
  it('?from=2026-01-01&to=2026-01-31 → label "custom"', () => {
    urlStore.set('href', 'http://localhost/?from=2026-01-01&to=2026-01-31');
    const r = S.parseRangeFromURL();
    assert.equal(r.label, 'custom');
    assert.equal(r.from, '2026-01-01');
    assert.equal(r.to, '2026-01-31');
  });
  it('?from com valor inválido é aceito como string (validação fica no applyRange)', () => {
    urlStore.set('href', 'http://localhost/?from=lixo');
    const r = S.parseRangeFromURL();
    assert.equal(r.from, 'lixo');
    assert.equal(r.label, 'custom');
  });
  it('?days=0 → from = hoje (edge case)', () => {
    urlStore.set('href', 'http://localhost/?days=0');
    const r = S.parseRangeFromURL();
    assert.equal(S.daysAgoISO(0), r.from);
  });
});

describe('parseTabFromURL', () => {
  it('sem param → "overview"', () => {
    urlStore.set('href', 'http://localhost/');
    assert.equal(S.parseTabFromURL(), 'overview');
  });
  it('?tab=strength → "strength"', () => {
    urlStore.set('href', 'http://localhost/?tab=strength');
    assert.equal(S.parseTabFromURL(), 'strength');
  });
  it('?tab=injection → cai no default (whitelist)', () => {
    urlStore.set('href', 'http://localhost/?tab=<script>');
    assert.equal(S.parseTabFromURL(), 'overview');
  });
  it('?tab=history → "history"', () => {
    urlStore.set('href', 'http://localhost/?tab=history');
    assert.equal(S.parseTabFromURL(), 'history');
  });
});

describe('syncRangeToURL', () => {
  it('from + to → escreve ?from=&to=', () => {
    urlStore.set('href', 'http://localhost/');
    S.syncRangeToURL({ from: '2026-01-01', to: '2026-01-31' });
    const r = S.parseRangeFromURL();
    assert.equal(r.from, '2026-01-01');
    assert.equal(r.to, '2026-01-31');
  });
  it('só from → converte para ?days=N (pode arredondar para cima entre dois dias UTC)', () => {
    urlStore.set('href', 'http://localhost/');
    S.syncRangeToURL({ from: S.daysAgoISO(7), to: null });
    const r = S.parseRangeFromURL();
    // Aceita 7d ou 8d: se o teste cruza meia-noite UTC, arredonda para cima.
    assert.ok(r.label === '7d' || r.label === '8d',
      `expected 7d or 8d, got ${r.label}`);
  });
  it('sem from e sem to → limpa params existentes', () => {
    urlStore.set('href', 'http://localhost/?from=2026-01-01&to=2026-01-31');
    S.syncRangeToURL({ from: null, to: null });
    const r = S.parseRangeFromURL();
    assert.equal(r.label, 'all');
  });
});

describe('persistState + loadState', () => {
  it('persistState grava JSON em localStorage', () => {
    lsStore.clear();
    S.App.range = { from: '2026-01-01', to: '2026-12-31', label: 'custom' };
    S.App.tab = 'strength';
    S.persistState();
    const raw = lsStore.get('gym-dashboard');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.range.label, 'custom');
    assert.equal(parsed.tab, 'strength');
  });
  it('loadState restaura range quando App.range é "all"; tab não é sobrescrito se já setado', () => {
    // Comportamento documentado: loadState só restaura tab se App.tab
    // for falsy (default 'overview' bloqueia restauração). Para range,
    // só restaura se App.range.label === 'all'.
    lsStore.clear();
    lsStore.set('gym-dashboard', JSON.stringify({ range: { from: '2026-02-01', to: null, label: '7d' }, tab: 'consistency' }));
    S.App.range = { from: null, to: null, label: 'all' };
    S.App.tab = 'overview';
    S.loadState();
    assert.equal(S.App.range.label, '7d');
    // tab permanece 'overview' (default bloqueia restauro)
    assert.equal(S.App.tab, 'overview');
  });
  it('loadState não sobrescreve range já setado', () => {
    lsStore.clear();
    lsStore.set('gym-dashboard', JSON.stringify({ range: { from: '2026-02-01', to: null, label: '7d' }, tab: 'consistency' }));
    S.App.range = { from: '2026-01-01', to: null, label: 'custom' };
    S.loadState();
    assert.equal(S.App.range.label, 'custom');
  });
  it('loadState com JSON corrompido → silenciosamente não faz nada', () => {
    lsStore.clear();
    lsStore.set('gym-dashboard', '{range:');
    S.App.range = { from: null, to: null, label: 'all' };
    assert.doesNotThrow(() => S.loadState());
    assert.equal(S.App.range.label, 'all');
  });
});
