/**
 * js/measurements.js — Measurement data
 *
 * Namespace: window.Measurements
 */
window.Measurements = (function () {
  let cache = null;

  async function load() {
    if (cache) return cache;
    try {
      const [m, ml] = await Promise.all([
        fetch('data/Measurement.json').then(r => r.ok ? r.json() : []),
        fetch('data/MeasurementLog.json').then(r => r.ok ? r.json() : []),
      ]);
      cache = { measurements: m, logs: ml };
      return cache;
    } catch (err) {
      console.warn('Measurements.load falhou:', err);
      cache = { measurements: [], logs: [] };
      return cache;
    }
  }

  function buildTimeline(measurements, logs) {
    if (!measurements?.length && !logs?.length) return [];
    const timeline = [];
    for (const log of logs) {
      timeline.push({
        date: log.date ? new Date(log.date) : null,
        type: log.name || log.measurement?.name || 'Medida',
        value: typeof log.value === 'number' ? log.value : null,
      });
    }
    return timeline.filter(t => t.date && t.value !== null).sort((a, b) => a.date - b.date);
  }

  return { load, buildTimeline };
})();