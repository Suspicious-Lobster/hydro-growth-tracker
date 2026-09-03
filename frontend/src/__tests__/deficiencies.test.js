// MR-40: diagnose() ranks likely nutrient/root issues by summed symptom weight.
import { describe, it, expect } from 'vitest';
import { diagnose, SYMPTOMS, ISSUES } from '../data/deficiencies';

describe('diagnose', () => {
  it('ranks nitrogen first for yellowing lower leaves + stunted growth', () => {
    const results = diagnose(['yellowing_lower', 'stunted']);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('nitrogen');
  });

  it('ranks calcium first for blossom end rot', () => {
    const results = diagnose(['blossom_end_rot']);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('calcium');
  });

  it('returns [] for no ticked symptoms', () => {
    expect(diagnose([])).toEqual([]);
    expect(diagnose(undefined)).toEqual([]);
  });

  it('only returns issues with a positive score', () => {
    const results = diagnose(['powdery']);
    expect(results.every((r) => r.score > 0)).toBe(true);
    expect(results.map((r) => r.id)).toEqual(['powdery_mildew']);
  });

  it('breaks ties alphabetically by label', () => {
    // yellowing_upper matches both iron (2) and ph_lockout (1) — not a tie by
    // itself, so combine with brown_spots (ph_lockout 1, calcium 1) to force a
    // real tie between calcium and ph_lockout at score 1 each.
    const results = diagnose(['brown_spots']);
    const scores = results.map((r) => r.score);
    // Whatever the scores, results must be sorted descending, and any equal
    // consecutive scores must be alphabetical by label.
    for (let i = 1; i < results.length; i += 1) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      if (scores[i - 1] === scores[i]) {
        expect(results[i - 1].label.localeCompare(results[i].label)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('includes a "why" string naming matched symptom labels', () => {
    const results = diagnose(['purple_stems']);
    const phosphorus = results.find((r) => r.id === 'phosphorus');
    expect(phosphorus.why).toContain('Purple stems');
  });

  it('exposes 14 symptoms and 10 issues', () => {
    expect(SYMPTOMS.length).toBe(14);
    expect(ISSUES.length).toBe(10);
  });
});
