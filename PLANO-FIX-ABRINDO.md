# Plano — Dashboard abrindo toda hora + melhorias

## Problemas identificados

### 1. Dois servidores HTTP competindo
- `gym-dashboard.service` (systemd, porta **8765**, oficial) — PID 1149, Restart=always
- Claude Code deixou um **servidor paralelo na porta 8901** do scratchpad dele — PID 125611, sem systemd, órfão
- Resultado: dois processos servindo o mesmo repo, ferramentas podem abrir em portas diferentes cada vez

### 2. Dashboard "abrindo toda hora"
Causa raiz: `Restart=always` + `RestartSec=5` no systemd → qualquer crash (ex: claude code matando o python) faz o serviço reiniciar e abrir nova janela. Combinado com:

- **Auto-refresh agressivo** — não verificado, mas provável que tenha polling/interval JS reabrindo a página
- **CSP permitindo `'unsafe-inline'`** — scripts inline podem estar disparando reloads
- **Múltiplas abas/janelas** — sem `window.opener` check, pode duplicar abas

### 3. CSS está carregando mas algumas seções podem estar bugadas
- `index.html` (7053B) linkando `css/styles.css` (1727 linhas) — correto
- Mas o HTML é fino demais → muito JS externo pesado carregado em ordem
- Sem verificação de que **estado vazio** vs **dados carregados** está bem diferenciado

## Plano de correção (5 fases)

### Fase 1 — Limpar servidor órfão
- [ ] Matar PID 125611 (servidor 8901 do scratchpad)
- [ ] Confirmar só 8765 ativo (`ss -tlnp | grep 8765`)
- [ ] Adicionar o PID 125611 ao `.gitignore` se necessário

### Fase 2 — Blindar o serviço systemd
- [ ] Mudar `Restart=always` → `Restart=on-failure` (só reinicia se cair de verdade)
- [ ] Aumentar `RestartSec=5` → `RestartSec=30` (evita loop)
- [ ] Adicionar `StartLimitIntervalSec=300` + `StartLimitBurst=3` (máx 3 restarts em 5min)
- [ ] Adicionar `NoNewPrivileges=yes` + `PrivateTmp=yes` (segurança)

### Fase 3 — Investigar e corrigir auto-reload
- [ ] Ler `js/main.js` + `js/ui.js` pra achar `setInterval`/`location.reload`/`window.open`
- [ ] Se houver auto-refresh: aumentar intervalo (5min → 30min) ou tornar opt-in via botão
- [ ] Adicionar detecção de aba já aberta (`BroadcastChannel` ou `localStorage` flag) pra não duplicar
- [ ] Remover `window.open()` ou calls automáticos

### Fase 4 — Melhorias visuais e UX
- [ ] Loading state com skeletons (já tem CSS `.skeleton`, falta usar)
- [ ] Empty state bonito quando JSON falha (msg clara + botão retry)
- [ ] Toast/notif pra ações (exportar, copiar link) sem `alert()`
- [ ] Modal close em ESC + click outside
- [ ] Salvar último período/aba selecionada em localStorage
- [ ] Adicionar favicon e meta tags OG (preview mobile)

### Fase 5 — Deploy Vercel
- [ ] Verificar `vercel.json` com cache headers corretos
- [ ] Push final pro GitHub dispara redeploy automático
- [ ] Confirmar site público funciona

## Estimativa
- Fase 1: 1 min (matar PID, confirmar)
- Fase 2: 3 min (editar service + reload)
- Fase 3: 10-15 min (ler código JS, ajustar)
- Fase 4: 20-30 min (CSS + UX improvements)
- Fase 5: 5 min (push, verificar deploy)

**Total: ~40-50 min** se for eu mesmo; Claude Code: 1-2h.

## Risco
- Mudar `Restart=always` → se cair, **não reinicia sozinho**. Você vai precisar reiniciar manualmente (`systemctl --user start gym-dashboard`).
- Auto-refresh removido: dados não atualizam ao vivo. Mas como você adiciona sessões manualmente, isso não é problema.

## Quer que eu execute?
