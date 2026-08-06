// Toast notification system — replaces alert()
// Usage: window.Toast.show('mensagem', 'success' | 'error' | 'info')
(function () {
  'use strict';

  let container = null;

  function ensureContainer() {
    if (container) return container;
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
    return container;
  }

  function show(message, type = 'info', duration = 3000) {
    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    c.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  window.Toast = { show };
})();
