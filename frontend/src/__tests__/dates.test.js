import { describe, it, expect } from 'vitest';
import { parseLocalDate, toLocalISO, todayLocalISO, logTime, dayKey, isDateOnly } from '../utils/dates';
import { formatDate } from '../utils/format';

// These assertions are built from LOCAL components, so they hold in every
// timezone by construction; CI additionally runs them under
// TZ=America/Los_Angeles and TZ=Pacific/Auckland, where the old UTC-based code
// produced the wrong day. (Node on Windows ignores TZ, so the negative-offset
// case can only be exercised on the Linux runner.)

describe('parseLocalDate', () => {
  it('parses a date-only string as LOCAL midnight of that day', () => {
    const d = parseLocalDate('2026-06-26');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 5, 26, 0]);
  });
  it('passes full timestamps through as instants', () => {
    expect(parseLocalDate('2026-06-26T10:00:00.000Z').getTime()).toBe(Date.UTC(2026, 5, 26, 10));
  });
  it('returns null for blank, garbage and impossible days', () => {
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate('not a date')).toBeNull();
    expect(parseLocalDate('2026-02-31')).toBeNull();
  });
  it('isDateOnly recognises only YYYY-MM-DD', () => {
    expect(isDateOnly('2026-06-26')).toBe(true);
    expect(isDateOnly('2026-06-26T00:00:00Z')).toBe(false);
    expect(isDateOnly(20260626)).toBe(false);
  });
});

describe('todayLocalISO / toLocalISO', () => {
  it('uses the local calendar day at 8pm (the US evening case)', () => {
    expect(todayLocalISO(new Date(2026, 5, 26, 20, 0, 0))).toBe('2026-06-26');
  });
  it('uses the local calendar day at 1am (the UTC+2 small-hours case)', () => {
    expect(todayLocalISO(new Date(2026, 5, 26, 1, 0, 0))).toBe('2026-06-26');
  });
  it('zero-pads month and day', () => {
    expect(toLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatDate renders the calendar day that was stored', () => {
  it('a date-only string renders its own day, never the day before', () => {
    expect(formatDate('2026-06-26')).toContain('26');
    expect(formatDate('2026-06-26')).toContain('2026');
    // Locale may zero-pad ('01 Jun 2026') or not ('Jun 1, 2026'); either way
    // the day must be the 1st, never the 31st of May.
    expect(formatDate('2026-06-01')).toMatch(/\b0?1\b/);
    expect(formatDate('2026-06-01')).not.toMatch(/31/);
  });
  it('blank and invalid input render empty', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('nope')).toBe('');
  });
});

describe('logTime / dayKey', () => {
  it('logTime prefers date over created_at and is NaN when neither parses', () => {
    expect(logTime({ date: '2026-06-26', created_at: '2020-01-01T00:00:00Z' })).toBe(new Date(2026, 5, 26).getTime());
    expect(logTime({ created_at: '2026-06-26T10:00:00Z' })).toBe(Date.UTC(2026, 5, 26, 10));
    expect(Number.isNaN(logTime({}))).toBe(true);
  });
  it('dayKey separates 23:30 and the next 00:30 into two local days', () => {
    const late = new Date(2026, 5, 26, 23, 30);
    const early = new Date(2026, 5, 27, 0, 30);
    expect(dayKey(early) - dayKey(late)).toBe(1);
  });
  it('dayKey of a date-only log equals dayKey of that local day', () => {
    expect(dayKey({ date: '2026-06-26' })).toBe(dayKey(new Date(2026, 5, 26, 15)));
  });
});
