/**
 * js/export.js — Export PNG + share URL
 *
 * Namespace: window.Export
 *
 * Requer html2canvas global (loaded via CDN).
 */
window.Export = (function () {
  async function toPNG() {
    if (typeof html2canvas !== 'function') {
      throw new Error('html2canvas não carregou. Verifique CSP e CDN.');
    }
    const el = document.querySelector('.wrap');
    const canvas = await html2canvas(el, {
      backgroundColor: '#0f0f0f',
      scale: window.devicePixelRatio || 1,
      logging: false,
    });
    const link = document.createElement('a');
    link.download = `gym-evolucao-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.append(link);
    link.click();
    link.remove();
  }

  async function shareURL() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, url };
    } catch {
      return { ok: false, url };
    }
  }

  return { toPNG, shareURL };
})();