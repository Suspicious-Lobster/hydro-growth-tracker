import { describe, it, expect } from 'vitest';
import { VOICE_KEYS, VOICES, TOWELIE_MARKERS, getVoice, compose, seedFrom } from '../data/budVoice';

// A number-placeholder or a plant name should never live inside a voice
// table — those belong to the factual clause the caller supplies. We can't
// enumerate every possible plant name, but any digit in a voice line is
// itself a smell (bands/ages/percentages are always facts, never jokes).
const hasDigit = (s) => /\d/.test(s);
const PLANT_NAME_SMELLS = ['tomato', 'cannabis', 'basil', 'lettuce', 'pepper', 'cucumber'];

describe('budVoice tables', () => {
  it('both voices define every required key', () => {
    for (const name of ['towelie', 'clean']) {
      const voice = VOICES[name];
      for (const key of VOICE_KEYS) {
        expect(voice).toHaveProperty(key);
        expect(Array.isArray(voice[key])).toBe(true);
      }
    }
  });

  it('the towelie tangent pool has at least 12 entries', () => {
    expect(VOICES.towelie.tangent.length).toBeGreaterThanOrEqual(12);
  });

  it('the towelie catchphrase pool has at least 8 entries', () => {
    expect(VOICES.towelie.catchphrase.length).toBeGreaterThanOrEqual(8);
  });

  it('no voice string contains a digit (numbers are facts, not jokes)', () => {
    for (const name of ['towelie', 'clean']) {
      const voice = VOICES[name];
      for (const key of VOICE_KEYS) {
        for (const line of voice[key]) {
          expect(hasDigit(line)).toBe(false);
        }
      }
    }
  });

  it('no voice string contains a plant name', () => {
    for (const name of ['towelie', 'clean']) {
      const voice = VOICES[name];
      for (const key of VOICE_KEYS) {
        for (const line of voice[key]) {
          const lower = line.toLowerCase();
          for (const smell of PLANT_NAME_SMELLS) {
            expect(lower.includes(smell)).toBe(false);
          }
        }
      }
    }
  });

  it('TOWELIE_MARKERS is the towelie catchphrase list', () => {
    expect(TOWELIE_MARKERS).toEqual(VOICES.towelie.catchphrase);
    expect(TOWELIE_MARKERS.length).toBeGreaterThan(0);
  });

  it('getVoice falls back to towelie for an unknown name', () => {
    expect(getVoice('nonsense')).toBe(VOICES.towelie);
    expect(getVoice(undefined)).toBe(VOICES.towelie);
  });

  it('clean has no tangents and no catchphrases', () => {
    expect(VOICES.clean.tangent).toEqual([]);
    expect(VOICES.clean.catchphrase).toEqual([]);
  });
});

describe('budVoice.compose', () => {
  it('always includes the fact clause verbatim', () => {
    const out = compose('towelie', 'alertPrefix', 'pH is 7.4, aim 5.8-6.2.', { seed: 3 });
    expect(out).toContain('pH is 7.4, aim 5.8-6.2.');
  });

  it('is deterministic for the same seed', () => {
    const a = compose('towelie', 'milestone', 'fact one', { seed: 5 });
    const b = compose('towelie', 'milestone', 'fact one', { seed: 5 });
    expect(a).toBe(b);
  });

  it('falls back to just the fact when the pool is empty', () => {
    expect(compose('clean', 'tangent', 'the fact', { seed: 0 })).toBe('the fact');
  });

  it('falls back to towelie for an unknown voice name', () => {
    const out = compose('bogus', 'alertPrefix', 'the fact', { seed: 0 });
    expect(out).toContain('the fact');
  });
});

describe('budVoice.seedFrom', () => {
  it('is deterministic for the same input', () => {
    expect(seedFrom('alert:1:ph:out')).toBe(seedFrom('alert:1:ph:out'));
  });

  it('is non-negative', () => {
    expect(seedFrom('anything')).toBeGreaterThanOrEqual(0);
  });
});
