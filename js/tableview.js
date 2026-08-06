/**
 * js/tableview.js — Gêmeo em tabela de cada gráfico
 *
 * Namespace: window.TableView
 *
 * Um gráfico não pode ser o único caminho até o valor: quem usa leitor de tela,
 * quem não distingue as cores das séries e quem só quer o número exato precisam
 * de uma leitura textual equivalente. O tooltip não resolve isso — ele exige
 * mouse e some ao sair.
 *
 * Cada .chart-box com canvas ganha um botão que alterna canvas ↔ <table>,
 * montada a partir dos dados que já estão no próprio Chart.js.
 */
window.TableView = (function () {
  const registry = new Map(); // canvasId -> { formatValue }

  function register(canvasId, options) {
    registry.set(canvasId, options || {});
    ensureToggle(canvasId);
  }

  function ensureToggle(canvasId) {
    const canvas = document.getElementById(canvasId);
    const box = canvas?.closest('.chart-box');
    if (!box || box.querySelector(`[data-table-for="${canvasId}"]`)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'table-toggle';
    btn.dataset.tableFor = canvasId;
    btn.textContent = 'Ver tabela';
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => toggle(canvasId, btn));

    const heading = box.querySelector('h2');
    if (heading) heading.append(btn);
    else box.prepend(btn);
  }

  function toggle(canvasId, btn) {
    const canvas = document.getElementById(canvasId);
    const box = canvas?.closest('.chart-box');
    if (!box) return;
    const existing = box.querySelector(`.chart-table[data-table-of="${canvasId}"]`);

    if (existing) {
      existing.remove();
      canvas.hidden = false;
      btn.textContent = 'Ver tabela';
      btn.setAttribute('aria-expanded', 'false');
      return;
    }

    const table = build(canvasId);
    if (!table) return;
    canvas.hidden = true;
    canvas.after(table);
    btn.textContent = 'Ver gráfico';
    btn.setAttribute('aria-expanded', 'true');
  }

  function build(canvasId) {
    const chart = window.State.App.charts[canvasId];
    if (!chart) return null;
    const { labels = [], datasets = [] } = chart.data;
    const opts = registry.get(canvasId) || {};
    const fmt = opts.formatValue || ((v) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : (v ?? '—')));

    const wrap = document.createElement('div');
    wrap.className = 'chart-table';
    wrap.dataset.tableOf = canvasId;

    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.textContent = opts.caption || 'Dados do gráfico';
    table.append(caption);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    // Scatter guarda pontos {x,y} e não tem labels: cada linha vira um ponto.
    const isScatter = !labels.length && datasets.some(d => Array.isArray(d.data) && typeof d.data[0] === 'object');
    const headers = isScatter
      ? [opts.seriesHeader || 'Série', opts.xHeader || 'X', opts.yHeader || 'Y']
      : [opts.labelHeader || 'Item', ...datasets.map(d => d.label || 'Valor')];
    for (const h of headers) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      headRow.append(th);
    }
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    if (isScatter) {
      for (const ds of datasets) {
        for (const p of ds.data) {
          const tr = document.createElement('tr');
          for (const cell of [ds.label, fmt(p.x, 'x'), fmt(p.y, 'y')]) {
            const td = document.createElement('td');
            td.textContent = String(cell);
            tr.append(td);
          }
          tbody.append(tr);
        }
      }
    } else {
      labels.forEach((label, i) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = String(label);
        tr.append(th);
        for (const ds of datasets) {
          const td = document.createElement('td');
          const v = ds.data[i];
          td.textContent = v === null || v === undefined ? '—' : String(fmt(v));
          tr.append(td);
        }
        tbody.append(tr);
      });
    }
    table.append(tbody);
    wrap.append(table);
    return wrap;
  }

  /** Fecha a tabela aberta para que o próximo render não mostre dados velhos. */
  function refresh(canvasId) {
    const canvas = document.getElementById(canvasId);
    const box = canvas?.closest('.chart-box');
    const open = box?.querySelector(`.chart-table[data-table-of="${canvasId}"]`);
    if (!open) return;
    open.replaceWith(build(canvasId) || document.createComment('sem dados'));
  }

  return { register, refresh };
})();
