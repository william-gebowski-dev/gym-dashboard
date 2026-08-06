/**
 * js/i18n.js — Strings PT-BR centralizadas
 *
 * Namespace: window.I18N
 */
window.I18N = (function () {
  const dict = {
    'app.title': 'Evolução de William',
    'header.lastUpdate': 'Atualizado',
    'header.lastWorkout': 'Último treino',
    'tabs.overview': 'Visão Geral',
    'tabs.strength': 'Força',
    'tabs.consistency': 'Consistência',
    'tabs.history': 'Histórico',
    'kpi.sessions': 'Treinos',
    'kpi.volume': 'Volume (kg)',
    'kpi.weeklyFreq': 'Frequência Semanal',
    'kpi.volumePerSession': 'Volume médio por treino (kg)',
    'kpi.currentAdherence': 'Semanas atuais com ≥{goal} treinos',
    'kpi.longestAdherence': 'Recorde de semanas',
    'kpi.weeksHit': 'Semanas cumpridas',
    'kpi.weeklyAvg': 'Frequência semanal média',
    'chart.volume': 'Volume Mensal',
    'chart.oneRm': 'Top 10 por 1RM',
    'chart.weekday': 'Frequência Semanal',
    'adherence.title': 'Aderência Semanal',
    'adherence.goal': 'Meta',
    'pr.title': 'Recordes Pessoais',
    'pr.group.new': 'Novos recordes (≤ 30 dias)',
    'pr.group.evolving': 'Em evolução (≤ 60 dias)',
    'pr.group.stagnant': 'Sem recorde novo há mais de 60 dias',
    'pr.label.new': 'NOVO',
    'pr.label.evolving': 'EM EVOLUÇÃO',
    'pr.label.stagnant': 'ESTAGNADO',
    'sessions.title': 'Últimas Sessões',
    'sessions.date': 'Data',
    'sessions.name': 'Nome',
    'sessions.exercises': 'Exercícios',
    'sessions.sets': 'Séries',
    'sessions.volume': 'Volume',
    'sessions.modal.hint': 'Drill-down completo em próxima iteração.',
    'summary.improving': 'Volume subiu {pct}% e frequência subiu {freqDelta} treinos/semana.',
    'summary.mixed': 'Volume subiu {pct}%, mas frequência caiu de {prevFreq} para {curFreq} treinos semanais.',
    'summary.declining': 'Volume caiu {pct}% e frequência caiu {freqDelta} treinos/semana.',
    'summary.flat': 'Desempenho estável em relação ao período anterior.',
    'summary.empty': 'Nenhuma sessão no período.',
    'summary.all': '{sessions} treinos entre {first} e {last} · {volume} kg movimentados · {freq} treinos por semana em média. Escolha um período acima para comparar com o intervalo anterior.',
    'delta.up': '↑ {pct}% vs período anterior',
    'delta.down': '↓ {pct}% vs período anterior',
    'delta.flat': '= estável vs período anterior',
    'loading': 'Carregando dados...',
    'error.load': 'Erro ao carregar. Rode via servidor (python -m http.server).',
  };

  function t(key, vars) {
    let s = dict[key] || key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
      }
    }
    return s;
  }

  return { t };
})();