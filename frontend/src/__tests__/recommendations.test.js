import { describe, it, expect } from 'vitest';
import { inferStage, getStageGuidance, getProfile, getProfileStages, hasOwnProfile } from '../data/recommendations';
import { GROWTH_STAGES, PLANT_TYPES } from '../data/plantKnowledge';

describe('recommendations', () => {
  it('respects an explicit stage', () => {
    expect(inferStage('tomato', 5, GROWTH_STAGES.MID_FLOWER)).toBe(GROWTH_STAGES.MID_FLOWER);
  });

  it('infers stage from species-specific height ranges', () => {
    // Tomato seedling 0-15cm, early_veg 15-30cm.
    expect(inferStage('tomato', 8)).toBe(GROWTH_STAGES.SEEDLING);
    expect(inferStage('tomato', 20)).toBe(GROWTH_STAGES.EARLY_VEG);
    // Lettuce vegetative is only 5-15cm — different curve from tomato.
    expect(inferStage('lettuce', 12)).toBe(GROWTH_STAGES.VEGETATIVE);
  });

  it('uses the most mature stage above the tallest range', () => {
    const stages = getProfileStages('lettuce');
    expect(inferStage('lettuce', 999)).toBe(stages[stages.length - 1]);
  });

  it('falls back to generic profile for unknown species', () => {
    expect(getProfile('does-not-exist')).toBe(getProfile(PLANT_TYPES.GENERIC));
  });

  it('returns usable guidance with EC and pH targets', () => {
    const g = getStageGuidance('tomato', GROWTH_STAGES.VEGETATIVE);
    expect(g.ec.min).toBeGreaterThan(0);
    expect(g.phRange.min).toBeGreaterThan(0);
    expect(g.label).toBe('Vegetative');
  });

  it('returns null stage for missing height', () => {
    expect(inferStage('tomato', null)).toBe(null);
  });

  // MR-34: every listed species except generic must have its own profile,
  // not silently fall back to the generic one.
  it('every PLANT_TYPES species except generic has its own profile', () => {
    for (const type of Object.values(PLANT_TYPES)) {
      if (type === PLANT_TYPES.GENERIC) continue;
      expect(getProfile(type)).not.toBe(getProfile(PLANT_TYPES.GENERIC));
    }
  });

  it('getProfile(basil) is not the generic profile', () => {
    expect(getProfile('basil')).not.toBe(getProfile(PLANT_TYPES.GENERIC));
  });

  it('hasOwnProfile identifies species with a real authored profile', () => {
    expect(hasOwnProfile('basil')).toBe(true);
    expect(hasOwnProfile('')).toBe(false);
    expect(hasOwnProfile('does-not-exist')).toBe(false);
  });

  it('infers vegetative stage for basil from its own height range', () => {
    // Basil vegetative stage is 18-35cm.
    expect(inferStage('basil', 25)).toBe(GROWTH_STAGES.VEGETATIVE);
  });
});
