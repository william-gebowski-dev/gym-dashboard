/**
 * js/coach.js — Coach adherence
 *
 * Namespace: window.Coach
 */
window.Coach = (function () {
  let cache = null;

  async function load() {
    if (cache) return cache;
    try {
      const res = await fetch('data/CoachWorkout.json');
      if (!res.ok) {
        cache = [];
        return cache;
      }
      cache = await res.json();
      return cache;
    } catch (err) {
      console.warn('Coach.load falhou:', err);
      cache = [];
      return cache;
    }
  }

  function computeAdherence(coachWorkouts, actualSessions) {
    const byWeek = new Map();
    for (const cw of coachWorkouts) {
      const weekKey = cw.weekKey || cw.weekStartDate || 'unknown';
      byWeek.set(weekKey, { planned: 0, completed: 0, sessions: [] });
    }
    for (const s of actualSessions) {
      const date = s.date ?? (s.startDate ? new Date(s.startDate) : null);
      if (!date) continue;
      const monday = new Date(date);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const weekKey = monday.toISOString().slice(0, 10);
      const bucket = byWeek.get(weekKey) ?? { planned: 0, completed: 0, sessions: [] };
      bucket.completed += 1;
      bucket.sessions.push(s);
      byWeek.set(weekKey, bucket);
    }
    return [...byWeek.entries()]
      .map(([week, b]) => ({
        week,
        planned: b.planned,
        completed: b.completed,
        adherencePct: b.planned > 0 ? Math.round((b.completed / b.planned) * 100) : null,
      }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-8);
  }

  return { load, computeAdherence };
})();