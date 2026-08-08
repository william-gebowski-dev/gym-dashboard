/**
 * js/tabs.js — Navegação por abas
 *
 * Namespace: window.Tabs
 */
window.Tabs = (function () {
  const { App } = window.State;

  function getTabButtons() {
    return Array.from(document.querySelectorAll('.tabs-nav button[data-tab]'));
  }

  function focusTab(idx) {
    const btns = getTabButtons();
    if (!btns.length) return;
    const next = btns[(idx + btns.length) % btns.length];
    next.focus();
    switchTo(next.dataset.tab);
  }

  function init() {
    const nav = document.querySelector('.tabs-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      switchTo(btn.dataset.tab);
    });
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-tab-target]');
      if (!trigger) return;
      switchTo(trigger.dataset.tabTarget);
    });
    nav.addEventListener('keydown', (e) => {
      const btns = getTabButtons();
      const idx = btns.indexOf(document.activeElement);
      if (idx === -1) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); focusTab(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); focusTab(idx - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusTab(0); }
      else if (e.key === 'End') { e.preventDefault(); focusTab(btns.length - 1); }
    });
    switchTo(App.tab || 'overview');
  }

  function switchTo(name) {
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.hidden = panel.dataset.tab !== name;
    });
    document.querySelectorAll('.tabs-nav button[data-tab]').forEach((btn) => {
      const isActive = btn.dataset.tab === name;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    App.tab = name;
    if (window.State && window.State.syncTabToURL) window.State.syncTabToURL(name);
    document.dispatchEvent(new CustomEvent('gym:tabchange', { detail: { tab: name } }));
  }

  return { init, switch: switchTo };
})();