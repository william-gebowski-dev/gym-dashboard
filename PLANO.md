# 📋 Análise & Plano de Melhoria — gym-dashboard

##Estado Atual (03/08/2026)

### Repo
- GitHub: `william-gebowski-dev/gym-dashboard` ✅
- 1 commit: `2202c90 Initial commit: gym dashboard refatorado`
- Git status: clean (tudo commitado)

### Estrutura
```
gym-dashboard/
├── .gitignore          (ignora data/*.json, backups)
├── README.md           (~20 linhas, básico)
├── index.html          (373 linhas, single-file)
├── js/app.js           (17 linhas, minúsculo)
└── data/               (23 JSONs, 21MB)
    ├── WorkoutSession.json (4.2MB — principal)
    ├── CoachWeek.json
    ├── CoachAssessment.json
    ├── CoachWorkout.json
    ├── Equipment.json
    ├── Exercise.json
    ├── Measurement.json
    └── ... (16 outros)
```

### O que funciona
- ✅ Dark theme (#0f0f0f / #1a1a2e / #e94560)
- ✅ KPIs (sessões, volume, média, último treino)
- ✅ Gráfico volume mensal (Chart.js)
- ✅ Top 10 exercícios por 1RM
- ✅ Frequência semanal
- ✅ Tabela últimas sessões
- ✅ Servido via systemd (porta 8765)

### O que NÃO funciona / falta
- ❌ Seções novas (PRs, Volume por grupo, Consistência, Coach, Equipment) — CSS existe mas JS incompleto
- ❌ index.html perdeu funcionalidades na última refactoração (só 373 linhas vs 956 anteriores)
- ❌ Sem gráfico de evolução por exercício
- ❌ Sem filtro por grupo muscular
- ❌ Sem heatmap de frequência
- ❌ js/app.js só tem 17 linhas (quase vazio)
- ❌ README minimalista
- ❌ Sem LICENSE
- ❌ Sem CONTRIBUTING.md
- ❌ Dados JSON não versionados (.gitignore os ignora — bem feito)
- ❌ Sem CI/CD
- ❌ Sem testes

---

## 🎯 Plano de Melhoria

### Fase 1 — Restaurar funcionalidades perdidas (URGENTE)
1. **Recriar index.html completo** com todas as seções:
   - KPIs
   - Volume mensal
   - Top 10 1RM
   - Heatmap frequência semanal
   - Filtro grupo muscular + lista exercícios
   - Evolução por exercício (select + gráfico + 4 mini-cards)
   - Tabela últimas sessões
   - **NOVO:** PRs (grid de cards)
   - **NOVO:** Volume por grupo muscular (barras horizontais)
   - **NOVO:** Consistência (streaks, gaps, treinos/semana)
   - **NOVO:** Aderência ao coach (barra de progresso)
   - **NOVO:** Uso por equipamento (doughnut)
   - Botão back-to-top
   - Tooltips melhorados
   - Subtítulos descritivos

2. **Migrar JS para js/app.js** (separar estrutura de lógica)

### Fase 2 — Qualidade de código
3. **Separar CSS para css/style.css**
4. **Adicionar README.md completo** com:
   - Screenshots
   - Instruções de instalação
   - Estrutura do projeto
   - Dados suportados
   - Como contribuir
5. **Adicionar LICENSE** (MIT)
6. **Adicionar CONTRIBUTING.md**

### Fase 3 — Deploy & DevOps
7. **Configurar GitHub Pages** (deploy estático gratuito)
8. **Adicionar GitHub Actions** (lint + deploy automático)
9. **Adicionar .editorconfig**
10. **Criar branch `dev`** + flow de PR

### Fase 4 — Funcionalidades novas
11. **Modo claro/escuro** (toggle)
12. **Exportar PDF** (gerar relatório para personal)
13. **PWA** (instalar no celular)
14. **Dados de medidas corporais** (MeasurementLog)
15. **Comparação de períodos** (mês vs mês)

---

## 📊 Total: 138→139 sessões, 48 exercícios, 3206 séries, 804k volume
