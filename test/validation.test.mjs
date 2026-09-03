// Unit tests for validation.js: every rule at its boundary. These are the
// rules the frontend will import too (MR-33), so a wrong bound here is a wrong
// bound everywhere.

import { describe, it, expect } from 'vitest';
import { validateLog, validatePlant, validateSchedule } from '../validation.js';

const base = { plant_name: 'Tomato', date: '2026-06-26', height: 10, nutrients: 'GH' };
const errorsFor = (over, opts) => validateLog({ ...base, ...over }, opts);
const only = (errs, needle) => errs.filter((e) => e.includes(needle));

describe('validateLog: identity', () => {
  it('accepts a minimal valid log', () => {
    expect(validateLog(base)).toEqual([]);
  });
  it('requires a plant name when no plant_id', () => {
    expect(only(errorsFor({ plant_name: '' }), 'Plant name')).toHaveLength(1);
    expect(only(errorsFor({ plant_name: '   ' }), 'Plant name')).toHaveLength(1);
    expect(only(errorsFor({ plant_name: undefined }), 'Plant name')).toHaveLength(1);
  });
  it('accepts plant_id in place of a name (numeric or string)', () => {
    expect(errorsFor({ plant_name: undefined, plant_id: 3 })).toEqual([]);
    expect(errorsFor({ plant_name: undefined, plant_id: '3' })).toEqual([]);
  });
  it('treats empty-string plant_id as absent', () => {
    expect(only(errorsFor({ plant_name: undefined, plant_id: '' }), 'Plant name')).toHaveLength(1);
  });
  it('caps plant name at 100 characters (100 ok, 101 rejected)', () => {
    expect(errorsFor({ plant_name: 'x'.repeat(100) })).toEqual([]);
    expect(only(errorsFor({ plant_name: 'x'.repeat(101) }), 'less than 100')).toHaveLength(1);
  });
});

describe('validateLog: date', () => {
  it('requires a date on create', () => {
    expect(only(errorsFor({ date: undefined }), 'Date is required')).toHaveLength(1);
  });
  it('rejects an unparseable date', () => {
    expect(only(errorsFor({ date: 'not-a-date' }), 'valid date')).toHaveLength(1);
  });
  it('does not require a date on update', () => {
    expect(errorsFor({ date: undefined }, { requireDate: false })).toEqual([]);
  });
});

describe('validateLog: height', () => {
  it('requires height', () => {
    expect(only(errorsFor({ height: undefined }), 'Height is required')).toHaveLength(1);
    expect(only(errorsFor({ height: '' }), 'Height is required')).toHaveLength(1);
  });
  it('accepts 0 and the cm cap of 1000, rejects 1000.1 and negatives', () => {
    expect(errorsFor({ height: 0 })).toEqual([]);
    expect(errorsFor({ height: 1000 })).toEqual([]);
    expect(only(errorsFor({ height: 1000.1 }), 'between 0 and 1000 cm')).toHaveLength(1);
    expect(only(errorsFor({ height: -0.1 }), 'between 0 and 1000 cm')).toHaveLength(1);
  });
  it('uses the 400 cap when height_unit is in', () => {
    expect(errorsFor({ height: 400, height_unit: 'in' })).toEqual([]);
    expect(only(errorsFor({ height: 400.1, height_unit: 'in' }), 'between 0 and 400 in')).toHaveLength(1);
  });
  it('rejects a non-numeric height', () => {
    expect(only(errorsFor({ height: 'tall' }), 'Height must be a number')).toHaveLength(1);
  });
});

describe('validateLog: text fields', () => {
  it('nutrients text is optional (MR-37: a quick pH/EC/height log is valid)', () => {
    expect(errorsFor({ nutrients: '' })).toEqual([]);
    expect(errorsFor({ nutrients: undefined })).toEqual([]);
  });
  it('caps nutrients at 500 and notes at 1000', () => {
    expect(errorsFor({ nutrients: 'n'.repeat(500) })).toEqual([]);
    expect(only(errorsFor({ nutrients: 'n'.repeat(501) }), 'Nutrients description')).toHaveLength(1);
    expect(errorsFor({ notes: 'n'.repeat(1000) })).toEqual([]);
    expect(only(errorsFor({ notes: 'n'.repeat(1001) }), 'Notes must be')).toHaveLength(1);
  });
});

describe('validateLog: measurement ranges', () => {
  const cases = [
    ['ph', 0, 14, 14.1],
    ['ec', 0, 5, 5.1],
    ['ppm', 0, 3000, 3001],
    ['humidity', 0, 100, 100.5],
    ['light_hours', 0, 24, 24.5],
    ['water_temp', -50, 100, 100.5],
    ['air_temp', -50, 100, -50.5],
    ['reservoir_volume', 0, 100000, 100001],
  ];
  for (const [key, min, max, outside] of cases) {
    it(`${key}: accepts ${min} and ${max}, rejects ${outside}, ignores blank`, () => {
      expect(errorsFor({ [key]: min })).toEqual([]);
      expect(errorsFor({ [key]: max })).toEqual([]);
      expect(errorsFor({ [key]: outside })).toHaveLength(1);
      expect(errorsFor({ [key]: '' })).toEqual([]);
      expect(errorsFor({ [key]: null })).toEqual([]);
    });
  }
  it('rejects a non-numeric measurement', () => {
    expect(only(errorsFor({ ph: 'acid' }), 'pH must be a number')).toHaveLength(1);
  });
  it('reports every failing rule, not just the first', () => {
    const errs = validateLog({ plant_name: '', date: 'x', height: 9999, doses: [{ name: '', ml_per_l: 1 }], ph: 99 });
    expect(errs.length).toBeGreaterThanOrEqual(5);
  });
});

describe('validatePlant', () => {
  it('requires a non-empty name', () => {
    expect(validatePlant({ name: 'Basil' })).toEqual([]);
    expect(validatePlant({ name: '' })).toHaveLength(1);
    expect(validatePlant({})).toHaveLength(1);
  });
  it('caps name at 100 and the four text fields at 100', () => {
    expect(validatePlant({ name: 'x'.repeat(101) })).toHaveLength(1);
    for (const k of ['variety', 'species', 'system_type', 'target_stage']) {
      expect(validatePlant({ name: 'ok', [k]: 'y'.repeat(100) })).toEqual([]);
      expect(validatePlant({ name: 'ok', [k]: 'y'.repeat(101) })).toHaveLength(1);
    }
  });
  it('validates reservoir volume range and start_date parse', () => {
    expect(validatePlant({ name: 'ok', reservoir_volume: 100000 })).toEqual([]);
    expect(validatePlant({ name: 'ok', reservoir_volume: 100001 })).toHaveLength(1);
    expect(validatePlant({ name: 'ok', start_date: '2026-01-01' })).toEqual([]);
    expect(validatePlant({ name: 'ok', start_date: 'yesterday-ish' })).toHaveLength(1);
  });
});

describe('validateSchedule', () => {
  it('requires a plant (id or name) and a nutrient type on create', () => {
    expect(validateSchedule({ plant_name: 'Tomato', nutrient_type: 'GH' })).toEqual([]);
    expect(validateSchedule({ plant_id: 2, nutrient_type: 'GH' })).toEqual([]);
    expect(validateSchedule({ nutrient_type: 'GH' })).toHaveLength(1);
    expect(validateSchedule({ plant_name: 'Tomato' })).toHaveLength(1);
  });
  it('partial updates only validate the fields present', () => {
    expect(validateSchedule({ ec_level: '1.2' }, { partial: true })).toEqual([]);
    expect(validateSchedule({ plant_name: '' }, { partial: true })).toHaveLength(1);
    expect(validateSchedule({ nutrient_type: '' }, { partial: true })).toHaveLength(1);
  });
  it('accepts only the four frequencies', () => {
    for (const f of ['daily', 'every-2-days', 'weekly']) {
      expect(validateSchedule({ plant_id: 1, nutrient_type: 'GH', frequency: f })).toEqual([]);
    }
    expect(validateSchedule({ plant_id: 1, nutrient_type: 'GH', frequency: 'hourly' })).toHaveLength(1);
  });
  it('custom frequency needs an interval between 1 and 365 days', () => {
    const c = (d) => validateSchedule({ plant_id: 1, nutrient_type: 'GH', frequency: 'custom', custom_interval_days: d });
    expect(c(1)).toEqual([]);
    expect(c(365)).toEqual([]);
    expect(c(0)).toHaveLength(1);
    expect(c(366)).toHaveLength(1);
    expect(c(undefined)).toHaveLength(1);
  });
});
