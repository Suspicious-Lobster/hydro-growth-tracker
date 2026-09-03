// MR-50: compareSeries aligns each plant's logs by whole days since ITS OWN
// first log (not by absolute calendar date), so plants started months apart
// still line up at day 0. Fixture below has plant A starting in March and
// plant B starting in June — the assertion on that precondition is the red
// proof: aligning by absolute date instead would put these logs on wildly
// different x values and the shared day-0/day-7 rows would never form.
import { describe, it, expect } from 'vitest';
import { compareSeries, METRICS } from '../components/CompareChart';

const plantA = { id: 1, name: 'Alpha' };
const plantB = { id: 2, name: 'Beta' };
const plantC = { id: 3, name: 'Gamma' }; // no logs

const logsById = {
  1: [
    { id: 1, plant_id: 1, date: '2026-03-01', height: 10, ph: 6.0, ec: 1.2 },
    { id: 2, plant_id: 1, date: '2026-03-08', height: 15, ph: 6.1, ec: 1.3 },
  ],
  2: [
    { id: 3, plant_id: 2, date: '2026-06-01', height: 5, ph: 5.9, ec: 1.0 },
    { id: 4, plant_id: 2, date: '2026-06-08', height: 8, ph: 6.0, ec: 1.1 },
  ],
  3: [],
};

const getPlantLogs = (plant) => logsById[plant.id] || [];

describe('compareSeries (MR-50)', () => {
  it('precondition: plant A and plant B start in different months', () => {
    expect(logsById[1][0].date.slice(0, 7)).toBe('2026-03');
    expect(logsById[2][0].date.slice(0, 7)).toBe('2026-06');
    expect(logsById[1][0].date.slice(0, 7)).not.toBe(logsById[2][0].date.slice(0, 7));
  });

  it('aligns both plants by days since their own first log, producing day 0 and day 7 rows with both names', () => {
    const rows = compareSeries([plantA, plantB], getPlantLogs, 'height');
    expect(rows).toHaveLength(2);

    const day0 = rows.find((r) => r.day === 0);
    const day7 = rows.find((r) => r.day === 7);
    expect(day0).toBeDefined();
    expect(day7).toBeDefined();

    expect(day0.Alpha).toBe(10);
    expect(day0.Beta).toBe(5);
    expect(day7.Alpha).toBe(15);
    expect(day7.Beta).toBe(8);
  });

  it('skips a plant with no logs', () => {
    const rows = compareSeries([plantA, plantC], getPlantLogs, 'height');
    for (const row of rows) {
      expect(row.Gamma).toBeUndefined();
    }
    // Alpha's own rows are unaffected by Gamma's absence.
    expect(rows.find((r) => r.day === 0).Alpha).toBe(10);
  });

  it('converts height to the display unit and rounds to 2dp', () => {
    const rows = compareSeries([plantA], getPlantLogs, 'height', { lengthUnit: 'in' });
    const day0 = rows.find((r) => r.day === 0);
    expect(day0.Alpha).toBeCloseTo(10 / 2.54, 2);
  });

  it('reads ph and ec metrics directly, with no unit conversion', () => {
    const phRows = compareSeries([plantA], getPlantLogs, 'ph');
    expect(phRows.find((r) => r.day === 0).Alpha).toBe(6.0);
    const ecRows = compareSeries([plantA], getPlantLogs, 'ec');
    expect(ecRows.find((r) => r.day === 7).Alpha).toBe(1.3);
  });

  it('exposes METRICS for the metric picker', () => {
    expect(METRICS.map((m) => m.key)).toEqual(['height', 'ph', 'ec']);
  });
});
