// MR-53: water and nutrient consumption and its cost, from reservoir events,
// dose rows and the settings' price list.
import { describe, it, expect } from 'vitest';
import { waterUsed, volumeInForce, nutrientUsed, grandCost, costSummary } from '../utils/cost';

const plant = { id: 1, name: 'Tomato', reservoir_volume: 12 };
const events = [
  { id: 1, plant_id: 1, kind: 'change', date: '2026-06-01', volume: 20 },
  { id: 2, plant_id: 1, kind: 'topoff', date: '2026-06-05', volume: 5 },
];

describe('waterUsed', () => {
  it('sums changes and top-offs', () => {
    expect(waterUsed(events)).toBe(25);
    expect(waterUsed([])).toBe(0);
    expect(waterUsed(undefined)).toBe(0);
  });
});

describe('volumeInForce', () => {
  it('uses the latest full change on or before the date, never a later one', () => {
    expect(volumeInForce('2026-06-03', events, plant)).toBe(20);
    expect(volumeInForce('2026-06-01', events, plant)).toBe(20);
    // Before any change the plant's configured reservoir applies.
    expect(volumeInForce('2026-05-30', events, plant)).toBe(12);
    // A top-off never sets the volume in force.
    expect(volumeInForce('2026-06-06', [events[1]], { reservoir_volume: null })).toBe(0);
  });
  it('picks the newest of two changes on the same day by id', () => {
    const twice = [
      { id: 1, kind: 'change', date: '2026-06-01', volume: 20 },
      { id: 2, kind: 'change', date: '2026-06-01', volume: 30 },
    ];
    expect(volumeInForce('2026-06-01', twice, plant)).toBe(30);
  });
});

describe('nutrientUsed', () => {
  it('multiplies ml/L by the reservoir volume in force (change event, not the plant setting)', () => {
    // Precondition for the red proof: the configured volume (12) differs from the change (20).
    expect(plant.reservoir_volume).not.toBe(events[0].volume);
    const logs = [{ id: 1, date: '2026-06-02', doses: [{ name: 'Part A', ml_per_l: 2 }] }];
    expect(nutrientUsed(logs, events, plant)).toEqual({ ml: { 'Part A': 40 }, unknownVolume: [] });
  });
  it('accumulates across logs and reports logs with no known volume', () => {
    const logs = [
      { id: 1, date: '2026-06-02', doses: [{ name: 'Part A', ml_per_l: 2 }, { name: 'Part B', ml_per_l: 1 }] },
      { id: 2, date: '2026-06-09', doses: [{ name: 'Part A', ml_per_l: 3 }] },
      { id: 3, date: '2026-06-10', doses: [] },
      { id: 4, date: '2026-05-01', doses: [{ name: 'Part A', ml_per_l: 1 }] },
    ];
    const noVolumePlant = { reservoir_volume: null };
    const r = nutrientUsed(logs, events, noVolumePlant);
    expect(r.ml).toEqual({ 'Part A': 100, 'Part B': 20 });
    expect(r.unknownVolume).toEqual([4]);
  });
});

describe('grandCost', () => {
  it('prices per liter of product from ml used, lists unpriced names', () => {
    const usage = { ml: { 'Part A': 40, Bloom: 10 } };
    const r = grandCost(usage, [{ name: 'part a', price_per_liter: 30 }]);
    expect(r.total).toBe(1.2);
    expect(r.lines).toEqual([
      { name: 'Part A', ml: 40, cost: 1.2 },
      { name: 'Bloom', ml: 10, cost: null },
    ]);
    expect(r.unpriced).toEqual(['Bloom']);
  });
  it('is zero with nothing used', () => {
    expect(grandCost({ ml: {} }, [])).toEqual({ total: 0, lines: [], unpriced: [] });
  });
});

describe('costSummary', () => {
  it('composes water, usage and cost', () => {
    const logs = [{ id: 1, date: '2026-06-02', doses: [{ name: 'Part A', ml_per_l: 2 }] }];
    const s = costSummary({ logs, events, plant, prices: [{ name: 'Part A', price_per_liter: 30 }] });
    expect(s.water).toBe(25);
    expect(s.total).toBe(1.2);
    expect(s.unpriced).toEqual([]);
  });
});
