/**
 * js/ui.js — Primitives DOM-safe
 *
 * Namespace: window.UI
 *
 * Funções:
 * - kpiCard(value, label): cria <div class=kpi> com value/label
 * - spanText(text): cria <span> com textContent
 * - escapeHtml(s): defesa contra XSS (mantida por compatibilidade)
 */
window.UI = (function () {
  function kpiCard(value, label) {
    const card = document.createElement('div');
    card.className = 'kpi';
    const v = document.createElement('div');
    v.className = 'value';
    v.textContent = String(value);
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = label;
    card.append(v, l);
    return card;
  }

  function spanText(text) {
    const s = document.createElement('span');
    s.textContent = text;
    return s;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { kpiCard, spanText, escapeHtml };
})();