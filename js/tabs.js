/**
 * js/tabs.js — Navegação por abas
 *
 * Namespace: window.Tabs
 */
window.Tabs = (function () {
  const { App } = window.State;

  function init() {
    const nav = document.querySelector('.tabs-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      switchTo(btn.dataset.tab);
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