// MR-43: pure filtering for the log list. LogViewer's toolbar builds a
// filters object and passes it here — kept separate from the component so
// the matching rules have one home and one set of unit tests.

// A filter object where every key is empty/undefined imposes no constraint,
// so the toolbar and the header count can share this one check instead of
// each re-deriving "is anything actually filtered right now".
export const isFilterActive = (filters = {}) => {
  const { q, plantId, from, to, stage, has } = filters;
  return Boolean((q && q.trim()) || plantId || from || to || stage || has);
};

const hasMeasurement = (log, key) => {
  if (key === 'photo') return typeof log.image_url === 'string' && log.image_url.length > 0;
  const value = log[key];
  return value !== null && value !== undefined && value !== '';
};

export const filterLogs = (logs, filters = {}) => {
  const { q, plantId, from, to, stage, has } = filters;
  const needle = q && q.trim() ? q.trim().toLowerCase() : '';

  return logs.filter((log) => {
    if (needle) {
      const haystack = [log.plant_name, log.nutrients, log.notes]
        .filter((v) => v != null)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (plantId !== undefined && plantId !== null && plantId !== '') {
      if (Number(log.plant_id) !== Number(plantId)) return false;
    }
    // Dates are stored as YYYY-MM-DD strings, which compare correctly as
    // plain text (see db/repository.js listLogs) — no Date parsing needed.
    if (from && !(log.date >= from)) return false;
    if (to && !(log.date <= to)) return false;
    if (stage && log.growth_stage !== stage) return false;
    if (has && !hasMeasurement(log, has)) return false;
    return true;
  });
};
