// MR-53: settings carry a nutrient price list (per liter of product), saved
// through PUT /settings, clamped and bounded.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshServer } from './helpers.mjs';
import * as repo from '../db/repository.js';

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

describe('nutrient prices', () => {
  it('saves a price list, normalising names and numbers, and survives a reload', async () => {
    const r = await s.put('/settings', { nutrient_prices: [{ name: '  Part A ', price_per_liter: '30' }, { name: 'Bloom', price_per_liter: 12.5 }] });
    expect(r.status).toBe(200);
    expect(r.data.nutrient_prices).toEqual([{ name: 'Part A', price_per_liter: 30 }, { name: 'Bloom', price_per_liter: 12.5 }]);
    expect((await s.get('/settings')).data.nutrient_prices).toHaveLength(2);
    expect(s.readFile().settings.nutrient_prices[0].name).toBe('Part A');
    // A patch without the key leaves the list alone.
    await s.put('/settings', { ppm_scale: 700 });
    expect((await s.get('/settings')).data.nutrient_prices).toHaveLength(2);
    // An empty list clears it.
    expect((await s.put('/settings', { nutrient_prices: [] })).data.nutrient_prices).toEqual([]);
  });

  it('refuses 21 entries, a nameless entry, a negative or absurd price, and a non-list', async () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `N${i}`, price_per_liter: 1 }));
    expect((await s.put('/settings', { nutrient_prices: many })).status).toBe(400);
    expect((await s.put('/settings', { nutrient_prices: many.slice(0, 20) })).status).toBe(200);
    for (const bad of [[{ name: '', price_per_liter: 1 }], [{ name: 'A', price_per_liter: -1 }], [{ name: 'A', price_per_liter: 100001 }], [{ name: 'A', price_per_liter: 'x' }], 'nope', [null]]) {
      const r = await s.put('/settings', { nutrient_prices: bad });
      expect(r.status).toBe(400);
      expect(r.data.details).toHaveLength(1);
    }
    // Nothing above changed the stored list (still the 20 accepted ones).
    expect((await s.get('/settings')).data.nutrient_prices).toHaveLength(20);
  });

  it('a pre-MR-53 file loads with an empty price list', () => {
    const d = repo.normalize({ schemaVersion: 2, plants: [], logs: [], settings: { units: { length: 'in' } } });
    expect(d.settings.nutrient_prices).toEqual([]);
    expect(d.settings.units.length).toBe('in');
    expect(repo.validateNutrientPrices([{ name: 'x'.repeat(61), price_per_liter: 1 }])).toMatch(/name/);
    expect(repo.validateNutrientPrices([{ name: 'ok', price_per_liter: 0 }])).toBeNull();
  });
});
