// Growth statistics derived from a plant's logs. Previously these calculations
// were copy-pasted across PlantCards, PlantManager, FeedingSchedule and
// PlantSidebar; this is now the single source.

import { logTime as rawLogTime } from './dates';

// Timestamp a log is ordered by: the user-entered measurement `date` (a local
// calendar day), falling back to the server insert time. Using `date` keeps
// backdated / out-of-order entries in true chronological order. Unparseable
// logs sort first (0) instead of scrambling the comparator with NaN.
function logTime(log) {
  const t = rawLogTime(log);
  return Number.isNaN(t) ? 0 : t;
}

// Return logs sorted oldest -> newest (does not mutate input). Ties on the same
// measurement date fall back to insert order.
export function sortLogsByDate(logs) {
  return [...(logs || [])].sort(
    (a, b) => logTime(a) - logTime(b) || new Date(a.created_at) - new Date(b.created_at),
  );
}

export function firstLog(logs) {
  const sorted = sortLogsByDate(logs);
  return sorted[0] || null;
}

export function latestLog(logs) {
  const sorted = sortLogsByDate(logs);
  return sorted[sorted.length - 1] || null;
}

export function currentHeight(logs) {
  const latest = latestLog(logs);
  return latest ? parseFloat(latest.height) || 0 : 0;
}

// Total height gained between the first and latest log, to one decimal.
export function totalGrowth(logs) {
  const sorted = sortLogsByDate(logs);
  if (sorted.length < 2) return 0;
  const growth = parseFloat(sorted[sorted.length - 1].height) - parseFloat(sorted[0].height);
  return Math.round(growth * 10) / 10;
}

// Whole days between the first and latest log (>= 0).
export function daysTracked(logs) {
  const sorted = sortLogsByDate(logs);
  if (sorted.length < 2) return 0;
  const ms = logTime(sorted[sorted.length - 1]) - logTime(sorted[0]);
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// Average growth per day (cm/day) to two decimals.
export function growthRate(logs) {
  const sorted = sortLogsByDate(logs);
  if (sorted.length < 2) return 0;
  const days = Math.max(daysTracked(logs), 1);
  const rate = (parseFloat(sorted[sorted.length - 1].height) - parseFloat(sorted[0].height)) / days;
  return Math.round(rate * 100) / 100;
}
