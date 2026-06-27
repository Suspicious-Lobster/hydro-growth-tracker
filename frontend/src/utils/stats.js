// Growth statistics derived from a plant's logs. Previously these calculations
// were copy-pasted across PlantCards, PlantManager, FeedingSchedule and
// PlantSidebar; this is now the single source.

// Return logs sorted oldest -> newest by created_at (does not mutate input).
export function sortLogsByDate(logs) {
  return [...(logs || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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
  const ms = new Date(sorted[sorted.length - 1].created_at) - new Date(sorted[0].created_at);
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
