# 🎨 Plano de Melhoria Visual — CSS

## Estado atual
- Dark theme básico: `#0f0f0f` / `#1a1a2e` / `#e94560`
- Sem gradientes nos cards (sólido `rgba(15,15,15,.35)`)
- Sem glassmorphism real — só bordas sutis
- Heatmap sem labels nas colunas
- Tabela sem hover highlight nos headers
- Sem skeleton loaders
- Sem micro-interações (hover só faz translateY)
- Sem scroll suave entre seções
- KPIs sem ícones
- Sem indicadores de trend (↑↓)

## Melhorias (ordenadas por impacto)

### 1. Glassmorphism real
- `backdrop-filter: blur(12px)` nos panels
- `background: rgba(26,26,46,.45)` com blur
- Bordas com `rgba(255,255,255,.08)` + `box-shadow` sutil

### 2. Gradientes e profundidade
- Hero: gradiente diagonal `135deg` mais rico (`#1a1a2e → #16213e → #0f3460`)
- KPIs: gradiente sutil no hover (`rgba(233,69,96,.05)`)
- Back-to-top: glow `box-shadow: 0 0 30px rgba(233,69,96,.4)`
- Cards de PR: gradiente vermelho mais vibrante

### 3. Micro-interações
- Hover panels: `scale(1.01)` + sombra
- Hover KPIs: número cresce `scale(1.05)` levemente
- Hover tabela: highlight linha com `rgba(233,69,96,.06)`
- Click exercício: ripple effect
- Charts: animação de entrada (Chart.js já tem mas configurar `animation.duration: 800`)

### 4. Tipografia
- Adicionar `h2` com `font-weight:700` + `letter-spacing:-.02em`
- `small` subtítulos com `opacity:.7` em vez de cor diferente
- Números de KPI com `tabular-nums` (font-variant-numeric)
- Spacing consistente com escala `8px` (8, 16, 24, 32, 40)

### 5. Skeleton loaders
- Durante fetch, mostrar placeholder cinza pulsante
- `@keyframes shimmer` para efeito de carregamento

### 6. KPIs com ícones
- Adicionar emoji por KPI: 📊 sessões, 💪 volume, 🏋️ peso máx, 🔢 séries, 🎯 exercícios, 📅 último mês
- Badge de trend: seta verde/vermelha ao lado do número

### 7. Heatmap melhorado
- Label de mês acima do grid
- Cores mais intuitivas (escala verde→amarelo→vermelho)
- Tooltip no hover mostrando data real
- Cells maiores no desktop

### 8. Scroll suave entre seções
- `scroll-behavior: smooth` no html
- Nav lateral fixa com links âncora (opcional)
- `scroll-snap-type` para parar em cada seção

### 9. Tabela melhorada
- Header sticky ao rolar
- Zebra striping sutil (`:nth-child(even)`)
- Volume com barra de progresso inline
- Data formatada como "há X dias"

### 10. Charts mais bonitos
- Tooltip custom: card escuro com sombra, cantos 12px, `padding: 12px 16px`
- Grid lines mais sutis: `rgba(255,255,255,.03)`
- Animação de entrada: `easing: 'easeOutQuart'`
- Doughnut: `cutout: 65%` para mais fino
- Bar: `borderRadius: 8` para cantos mais arredondados

### 11. Modo claro/escuro toggle
- Variáveis CSS já em `:root` — duplicar em `[data-theme="light"]`
- Botão toggle no canto superior direito do hero
- `localStorage` para persistir preferência
- `prefers-color-scheme: light` para detectar sistema

### 12. Detalhes finos
- Scrollbar customizada (dark) no Chrome
- `::selection` com cor accent
- Focus visible acessível (`outline: 2px solid var(--accent)`)
- `retina` displays: `box-shadow` com `0.5px` border
- Reduced motion: `@media (prefers-reduced-motion: reduce)` para desativar animações
