/**
 * js/export.js — Export PNG + share URL
 *
 * Namespace: window.Export
 *
 * html2canvas (45 KB) só é baixado no primeiro clique em "Exportar PNG".
 * Antes era carregado em toda visita, mesmo para quem nunca exporta.
 */
window.Export = (function () {
  const H2C_SRC = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const H2C_SRI = 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H';
  let h2cPromise = null;

  function loadHtml2Canvas() {
    if (typeof html2canvas === 'function') return Promise.resolve(html2canvas);
    if (h2cPromise) return h2cPromise;
    h2cPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = H2C_SRC;
      script.integrity = H2C_SRI;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (typeof html2canvas === 'function') resolve(html2canvas);
        else reject(new Error('html2canvas carregou mas não expôs a função.'));
      };
      script.onerror = () => {
        h2cPromise = null;
        reject(new Error('Não foi possível carregar html2canvas. Verifique a conexão e a CSP.'));
      };
      document.head.append(script);
    });
    return h2cPromise;
  }

  async function toPNG() {
    const render = await loadHtml2Canvas();
    const el = document.querySelector('.wrap');
    const canvas = await render(el, {
      backgroundColor: '#07080a',
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
