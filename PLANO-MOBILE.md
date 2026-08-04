# 📱 Plano de Melhoria Mobile

## Problemas atuais
- KPIs em 2 colunas — números grandes ficam apertados em telas <360px
- `.grid-layout` cai pra 1 coluna mas panels ainda com padding de desktop (24px)
- Charts com altura fixa (260px) — desperdiça espaço vertical em telas grandes/pequenas
- Heatmap 7 colunas fica ilegível em telas muito estreitas (<340px)
- Tabela de sessões não tem scroll horizontal — corta em mobile
- Select dropdown com `max-width:400px` mas telas pequenas o texto trunca sem reticências
- Sem tratamento de "notch"/safe-area (iPhone) no back-to-top
- Toque (touch target) dos botões pequenos <44px em alguns lugares (não segue guideline mobile)
- Sem pull-to-refresh nem indicador de "carregando mais"
- Textos de "mini-stats" (4 colunas) ficam MUITO espremidos no mobile
- Font-size do body não escala suficiente em telas muito pequenas (iPhone SE 320px)

## Melhorias propostas (ordenadas por impacto)

### 1. Touch targets ≥44px
- Todos botões (theme-toggle, back-to-top, selects) mínimo 44×44px
- Padding extra em áreas clicáveis (cards, linhas de tabela)

### 2. Tabela responsiva
- Envolver `<table>` com `overflow-x:auto` + `-webkit-overflow-scrolling:touch`
- Ou: transformar linhas em cards empilhados abaixo de 600px (`display:block` nas `<tr>`)

### 3. Grid adaptativo mais granular
- Breakpoints extras: 1024px (tablet), 640px (mobile grande), 380px (mobile pequeno)
- `.mini-stats`: 4→2 colunas em 768px, mantém 2 até 380px, então 1 coluna
- `.kpis`: manter auto-fit com minmax menor (140px) em vez de forçar 2 colunas fixas

### 4. Charts com altura fluida
- Trocar altura fixa por `aspect-ratio: 16/10` ou `clamp(200px, 40vw, 300px)`
- Evita chart cortado ou com espaço vazio

### 5. Heatmap mobile
- Abaixo de 400px: reduzir pra grid 7 colunas com `font-size` menor + esconder números, só cor
- Ou: rolagem horizontal com `min-width` por célula

### 6. Padding/spacing responsivo
- `.wrap`: 16px→12px em telas <380px
- `.panel`/`.hero`: padding com `clamp(16px, 4vw, 40px)`

### 7. Safe-area (notch/home indicator)
- `.back-to-top`: `bottom: calc(28px + env(safe-area-inset-bottom))`
- `<meta name="viewport" content="...,viewport-fit=cover">`

### 8. Tipografia fluida
- `h1`: já usa `clamp()` ✅ manter
- `body`: `font-size: clamp(14px, 3.5vw, 16px)` pra telas muito pequenas
- KPIs `.value`: `clamp(1.4rem, 5vw, 2rem)`

### 9. Selects e dropdowns mobile-friendly
- `width:100%` sem `max-width` fixo em mobile (usa `min()`)
- Font-size mínimo 16px (evita zoom automático do iOS Safari em inputs)

### 10. Sticky header mobile
- Considerar header compacto fixo no topo ao rolar (mostra apenas título + toggle tema)
- Ou manter simples — avaliar necessidade real

### 11. Performance mobile
- Lazy-render de charts fora da viewport (IntersectionObserver) — evita jank no load
- Debounce no resize/scroll listeners

### 12. Testar breakpoints reais
- iPhone SE (375×667), iPhone 14 (390×844), Galaxy S21 (360×800), iPad Mini (768×1024)
- Chrome DevTools device toolbar ou testar direto no celular via `http://192.168.1.111:8765`
