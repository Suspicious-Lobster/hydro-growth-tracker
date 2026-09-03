// Calendar-date helpers. One rule, applied everywhere: a log's `date` is a
// CALENDAR DAY in the user's own timezone ('YYYY-MM-DD'), never an instant.
//
// Why this file exists (MR-11): `new Date('2026-06-26')` parses a date-only
// string as UTC midnight, so rendering it in local time showed the previous day
// for anyone west of Greenwich, and `toISOString().slice(0, 10)` picked the UTC
// day, so the Add Log form defaulted to tomorrow in the evening (US) or
// yesterday in the small hours (this machine, UTC+2). Full timestamps
// (`created_at`, `last_fed`) are real instants and still go through Date.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isDateOnly = (value) => typeof value === 'string' && DATE_ONLY.test(value);

// Parse a stored date value. Date-only strings become LOCAL midnight of that
// calendar day; anything else is handed to Date. Returns null when invalid.
export function parseLocalDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (isDateOnly(value)) {
    const [, y, m, d] = DATE_ONLY.exec(value);
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    // Reject impossible days (e.g. 2026-02-31 rolls over in the constructor).
    if (dt.getMonth() !== Number(m) - 1 || dt.getDate() !== Number(d)) return null;
    return dt;
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const pad2 = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' for a Date, using its LOCAL calendar components.
export function toLocalISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Today's calendar day in the user's timezone; `now` is injectable for tests.
export const todayLocalISO = (now = new Date()) => toLocalISO(now);

// Millisecond timestamp a log is ordered by: the user-entered measurement
// `date` (as local midnight), falling back to the server insert time. NaN when
// neither parses, so callers can decide how to order the unparseable.
export function logTime(log) {
  const dt = parseLocalDate(log?.date ?? log?.created_at);
  return dt ? dt.getTime() : NaN;
}

// Integer index of a LOCAL calendar day (days since the epoch, computed from
// local components so a 23:30 log and the next day's 00:30 log land in two
// different buckets in every timezone). Accepts a Date, a timestamp, or a log.
export function dayKey(value) {
  let dt;
  if (value instanceof Date) dt = value;
  else if (typeof value === 'number') dt = new Date(value);
  else dt = parseLocalDate(value?.date ?? value?.created_at ?? value);
  if (!dt || Number.isNaN(dt.getTime())) return NaN;
  return Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000);
}
