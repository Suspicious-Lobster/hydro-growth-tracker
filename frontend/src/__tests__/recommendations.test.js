import { describe, it, expect } from 'vitest';
import { inferStage, getStageGuidance, getProfile, getProfileStages } from '../data/recommendations';
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
});
