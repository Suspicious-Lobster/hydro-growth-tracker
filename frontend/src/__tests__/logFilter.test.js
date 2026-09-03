// MR-43: pure filtering rules for the log list — text, plant, date range,
// stage, and measurement-presence, plus the shared "is anything filtered"
// derivation the header count and toolbar both use.
import { describe, it, expect } from 'vitest';
import { filterLogs, isFilterActive } from '../utils/logFilter';

const logs = [
  { id: 1, plant_id: 1, plant_name: 'Tomato', date: '2026-06-01', growth_stage: 'seedling', nutrients: 'FloraGro', notes: '', ph: 6.0, ec: null, ppm: null, image_url: null },
  { id: 2, plant_id: 2, plant_name: 'Basil', date: '2026-06-02', growth_stage: 'vegetative', nutrients: 'FloraBloom', notes: 'looking good', ph: null, ec: 1.2, ppm: null, image_url: null },
  { id: 3, plant_id: 1, plant_name: 'Tomato', date: '2026-06-05', growth_stage: 'vegetative', nutrients: '', notes: '', ph: null, ec: null, ppm: 500, image_url: 'uploads/pic.jpg' },
];

describe('filterLogs', () => {
  it('q matches plant_name case-insensitively', () => {
    const result = filterLogs(logs, { q: 'tomato' });
    expect(result.map((l) => l.id)).toEqual([1, 3]);
  });

  it('q matches nutrients and notes case-insensitively', () => {
    expect(filterLogs(logs, { q: 'florabloom' }).map((l) => l.id)).toEqual([2]);
    expect(filterLogs(logs, { q: 'GOOD' }).map((l) => l.id)).toEqual([2]);
  });

  it('plantId matches exactly (compared as numbers)', () => {
    expect(filterLogs(logs, { plantId: '1' }).map((l) => l.id)).toEqual([1, 3]);
    expect(filterLogs(logs, { plantId: 2 }).map((l) => l.id)).toEqual([2]);
  });

  it('from is inclusive on the date-only string and excludes earlier logs', () => {
    const result = filterLogs(logs, { from: '2026-06-02' });
    expect(result.map((l) => l.id)).toEqual([2, 3]);
    expect(result.some((l) => l.date === '2026-06-01')).toBe(false);
  });

  it('to is inclusive on the date-only string', () => {
    const result = filterLogs(logs, { to: '2026-06-02' });
    expect(result.map((l) => l.id)).toEqual([1, 2]);
  });

  it('stage matches exactly', () => {
    expect(filterLogs(logs, { stage: 'seedling' }).map((l) => l.id)).toEqual([1]);
  });

  it('has matches measurement presence: ph, ec, ppm, photo', () => {
    expect(filterLogs(logs, { has: 'ph' }).map((l) => l.id)).toEqual([1]);
    expect(filterLogs(logs, { has: 'ec' }).map((l) => l.id)).toEqual([2]);
    expect(filterLogs(logs, { has: 'ppm' }).map((l) => l.id)).toEqual([3]);
    expect(filterLogs(logs, { has: 'photo' }).map((l) => l.id)).toEqual([3]);
  });

  it('combines multiple filters with AND semantics', () => {
    const result = filterLogs(logs, { q: 'tomato', from: '2026-06-02', has: 'ppm' });
    expect(result.map((l) => l.id)).toEqual([3]);
  });

  it('empty logs array returns empty regardless of filters', () => {
    expect(filterLogs([], { q: 'anything' })).toEqual([]);
  });
});

describe('isFilterActive', () => {
  it('is false when no filters are set', () => {
    expect(isFilterActive({})).toBe(false);
    expect(isFilterActive({ q: '', plantId: '', from: '', to: '', stage: '', has: '' })).toBe(false);
  });

  it('is true when any single filter is set', () => {
    expect(isFilterActive({ q: 'basil' })).toBe(true);
    expect(isFilterActive({ plantId: '1' })).toBe(true);
    expect(isFilterActive({ from: '2026-06-01' })).toBe(true);
    expect(isFilterActive({ to: '2026-06-01' })).toBe(true);
    expect(isFilterActive({ stage: 'seedling' })).toBe(true);
    expect(isFilterActive({ has: 'ph' })).toBe(true);
  });
});
