/**
 * js/drop.js — Dropzone para file:// fallback
 *
 * Namespace: window.Drop
 *
 * showFileDropZone(): cria UI para arrastar data/WorkoutSession.json
 * quando fetch() falha em file://.
 */
window.Drop = (function () {
  const { normalizeSession } = window.Data;

  function showFileDropZone() {
    const drop = document.createElement('div');
    drop.id = 'dropzone';
    drop.style.cssText = `
      margin: 24px auto; padding: 40px; max-width: 720px;
      border: 2px dashed #e94560; border-radius: 12px; text-align: center;
      background: rgba(233,69,96,0.05); color: #fff;
      font-family: system-ui, sans-serif;
    `;
    // Mensagem instrucional via DOM construction (sem innerHTML)
    const h3 = document.createElement('h3');
    h3.style.marginTop = '0';
    const p = document.createElement('p');
    p.style.opacity = '.8';

    if (location.protocol === 'file:') {
      h3.append('📂 Arraste aqui o ');
      const code1 = document.createElement('code');
      code1.textContent = 'data/WorkoutSession.json';
      h3.appendChild(code1);
      p.append('Ou rode ');
      const code2 = document.createElement('code');
      code2.textContent = 'python -m http.server';
      p.appendChild(code2);
      p.append(' no diretório do projeto e abra ');
      const code3 = document.createElement('code');
      code3.textContent = 'http://localhost:8000';
      p.appendChild(code3);
      p.append('.');
    } else {
      h3.textContent = '📂 Arraste aqui o JSON de sessão';
      p.textContent = 'Tentaremos novamente após o drop.';
    }
    drop.append(h3, p);

    ['dragover', 'dragenter'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.style.background = 'rgba(233,69,96,0.12)'; }));
    ['dragleave', 'drop'].forEach(ev =>
      drop.addEventListener(ev, e => { e.preventDefault(); drop.style.background = 'rgba(233,69,96,0.05)'; }));

    drop.addEventListener('drop', async e => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) {
        alert('Arquivo muito grande (>50 MB).');
        return;
      }
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        if (!Array.isArray(raw)) throw new Error('JSON deve ser array de sessões');
        const sessions = raw.map(s => normalizeSession(s)).sort((a, b) => a.date - b.date);
        window.State.App.sessions = sessions;
        window.State.App.rawSessions = raw;
        window.State.App.sourceSig = 'dropped';
        drop.remove();
        window.Render.rerender();
      } catch (err) {
        alert(`Erro ao ler JSON: ${err.message}`);
      }
    });

    const hero = document.querySelector('header.hero');
    hero?.after(drop);
  }

  return { showFileDropZone };
})();