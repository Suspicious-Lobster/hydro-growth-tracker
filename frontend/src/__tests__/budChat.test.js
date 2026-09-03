import { describe, it, expect } from 'vitest';
import { answer, INTENTS } from '../data/budChat';
import { getProfile } from '../data/recommendations';
import { TOWELIE_MARKERS } from '../data/budVoice';

const plant = { id: 1, name: 'Tomato', species: 'tomato', target_stage: null };

describe('budChat data setup', () => {
  it('tomato phRange is 5.8-6.2 (precondition for the pH test below)', () => {
    expect(getProfile('tomato').phRange).toEqual({ min: 5.8, max: 6.2 });
  });
});

describe('answer() intents', () => {
  it("'what's my ph' cites the last pH and the band, flagged as an alert", () => {
    const input = {
      selectedPlant: plant,
      logs: [{ id: 1, date: '2026-01-01', ph: 7.1, height: 10 }],
      alerts: [],
    };
    const res = answer("what's my ph", input, { voice: 'towelie', now: 0 });
    expect(res.text).toContain('7.1');
    expect(res.text).toContain('5.8');
    expect(res.expression).toBe('alert');
  });

  it('an in-band pH is happy, not alert', () => {
    const input = {
      selectedPlant: plant,
      logs: [{ id: 1, date: '2026-01-01', ph: 6.0, height: 10 }],
      alerts: [],
    };
    const res = answer('ph check', input, { now: 0 });
    expect(res.text).toContain('6');
    expect(res.expression).toBe('happy');
  });

  it("'when can I harvest' returns the N-M day range for a late-flowering plant", () => {
    const input = {
      selectedPlant: plant,
      logs: [
        { id: 1, date: '2026-01-01', height: 40, growth_stage: 'late_flowering' },
      ],
      alerts: [],
    };
    const res = answer('when can I harvest', input, { now: new Date('2026-01-10').getTime() });
    expect(res.text).toMatch(/\d+-\d+/);
  });

  it('gibberish falls back to the shrug cue and still cites one real number', () => {
    const input = {
      selectedPlant: plant,
      logs: [{ id: 1, date: '2026-01-01', ph: 7.1, height: 10 }],
      alerts: [],
    };
    const res = answer('asdkjfhqwer zzxcv', input, { voice: 'towelie', now: 0 });
    expect(res.cue).toBe('shrug');
    expect(res.text).toMatch(/\d/);
  });

  it('gibberish with no plant selected still cites a number (the log count)', () => {
    const input = { selectedPlant: null, logs: [{ id: 1 }, { id: 2 }], alerts: [] };
    const res = answer('blorp fwibble', input, { now: 0 });
    expect(res.cue).toBe('shrug');
    expect(res.text).toContain('2');
  });

  it("clean voice never leaks a towelie catchphrase", () => {
    const input = {
      selectedPlant: plant,
      logs: [{ id: 1, date: '2026-01-01', ph: 7.1, height: 10 }],
      alerts: [],
    };
    const res = answer("what's my ph", input, { voice: 'clean', now: 0 });
    for (const marker of TOWELIE_MARKERS) {
      expect(res.text).not.toContain(marker);
    }
  });

  it('the deflection intent (high/smoke/joint) still ends on a useful, fact-bearing reminder', () => {
    const alert = { key: 'ph', label: 'pH', value: 7.4, range: { min: 5.8, max: 6.2 }, status: 'out' };
    const input = { selectedPlant: plant, logs: [], alerts: [alert] };
    const res = answer('you wanna get high', input, { voice: 'towelie', now: 0 });
    expect(res.text).toContain('5.8');
  });

  it('no plant selected returns the pick-a-plant fact for a plant-scoped intent', () => {
    const res = answer('how tall is it', { selectedPlant: null, logs: [], alerts: [] }, { now: 0 });
    expect(res.text).toContain("Pick a plant first");
  });

  it('no crash / stable output across calls with the same input', () => {
    const input = { selectedPlant: plant, logs: [{ id: 1, date: '2026-01-01', ph: 6.0 }], alerts: [] };
    const a = answer('hello', input, { now: 5 });
    const b = answer('hello', input, { now: 5 });
    expect(a).toEqual(b);
  });

  it('exports INTENTS as an ordered array covering the documented keys', () => {
    const keys = INTENTS.map((i) => i.key);
    expect(keys).toEqual(['ph', 'ec', 'height', 'harvest', 'reservoir', 'climate', 'badge', 'greeting', 'deflect', 'fallback']);
  });

  it('RED PROOF SITE: the fallback intent always carries a fact with a digit', () => {
    // (see budChat.test red-proof note in the report — this assertion is the
    // one that fails if the fallback fact is dropped)
    const input = { selectedPlant: null, logs: [], alerts: [] };
    const res = answer('xyzzy plugh', input, { now: 0 });
    expect(res.text).toMatch(/\d/);
  });
});
