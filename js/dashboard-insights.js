/**
 * js/dashboard-insights.js — pure functions for the redesigned mobile home
 *
 * Namespace: window.DashboardInsights
 *
 * Provides weekly aggregates, recent timeline, next-action suggestion and
 * month-over-month deltas. Pure, no DOM access; consumed by sections/overview.js.
 */
window.DashboardInsights = (function () {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function startOfWeekUTC(d) {
    const day = (d.getUTCDay() + 6) % 7; // Monday-first week
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  }

  function withinWindow(date, refDate, days) {
    return refDate.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000;
  }

  function weekWindow(refDate) {
    const start = startOfWeekUTC(refDate);
    const end = new Date(start.getTime() + WEEK_MS - 1);
    return { start, end };
  }

  function previousWeekWindow(refDate) {
    const current = weekWindow(refDate);
    return {
      start: new Date(current.start.getTime() - WEEK_MS),
      end: new Date(current.start.getTime() - 1),
    };
  }

  function buildWeek(sessions, refDate) {
    const { start, end } = weekWindow(refDate);
    const inWindow = sessions.filter(s => s.date >= start && s.date <= end);
    const volume = inWindow.reduce((acc, s) => acc + (s.volume || 0), 0);
    return {
      sessions: inWindow.length,
      volume,
      minutes: inWindow.reduce((acc, s) => acc + (s.durationMin || 0), 0),
      start,
      end,
    };
  }

  function buildPrevWeek(sessions, refDate) {
    const { start, end } = previousWeekWindow(refDate);
    const inWindow = sessions.filter(s => s.date >= start && s.date <= end);
    return {
      sessions: inWindow.length,
      volume: inWindow.reduce((acc, s) => acc + (s.volume || 0), 0),
      minutes: inWindow.reduce((acc, s) => acc + (s.durationMin || 0), 0),
      start,
      end,
    };
  }

  function pickNextAction(sessions, refDate) {
    if (!sessions.length) return null;
    const last90 = sessions.filter(s => withinWindow(s.date, refDate, 90));
    const pool = last90.length ? last90 : sessions;
    const counts = new Map();
    for (const s of pool) {
      if (!s.name) continue;
      counts.set(s.name, (counts.get(s.name) || 0) + 1);
    }
    let least = null;
    let leastCount = Infinity;
    for (const [name, count] of counts.entries()) {
      if (count < leastCount) {
        leastCount = count;
        least = name;
      }
    }
    return least;
  }

  function buildTimeline(sessions, limit = 4) {
    return [...sessions]
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);
  }

  function monthDelta(sessions, refDate) {
    const monthAgo = new Date(refDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(refDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const last = sessions.filter(s => s.date >= monthAgo).reduce((acc, s) => acc + (s.volume || 0), 0);
    const prior = sessions.filter(s => s.date >= twoMonthsAgo && s.date < monthAgo).reduce((acc, s) => acc + (s.volume || 0), 0);
    if (prior === 0) {
      return { current: last, previous: 0, deltaPct: last > 0 ? 100 : 0, hasBase: false };
    }
    const deltaPct = Math.round(((last - prior) / prior) * 100);
    return { current: last, previous: prior, deltaPct, hasBase: true };
  }

  function buildDashboardSnapshot(sessions, refDate = new Date()) {
    const sorted = [...sessions].sort((a, b) => a.date - b.date);
    const latest = sorted.length ? sorted[sorted.length - 1] : null;
    return {
      latest,
      week: buildWeek(sessions, refDate),
      prevWeek: buildPrevWeek(sessions, refDate),
      nextAction: pickNextAction(sessions, refDate),
      timeline: buildTimeline(sessions),
      monthDelta: monthDelta(sessions, refDate),
    };
  }

  return {
    buildDashboardSnapshot,
    buildWeek,
    buildPrevWeek,
    pickNextAction,
    buildTimeline,
    monthDelta,
  };
})();
