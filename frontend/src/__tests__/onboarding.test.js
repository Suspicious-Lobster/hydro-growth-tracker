import { describe, it, expect } from 'vitest';
import { TOUR_STEPS, stepCompleted } from '../data/onboarding';

describe('onboarding TOUR_STEPS', () => {
  it('starts with a welcome and ends with a finishable done step', () => {
    expect(TOUR_STEPS[0].id).toBe('welcome');
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    expect(last.id).toBe('done');
    expect(last.primary).toBe('finish');
  });

  it('every step has text and a primary action', () => {
    for (const s of TOUR_STEPS) {
      expect(typeof s.text).toBe('string');
      expect(s.text.length).toBeGreaterThan(0);
      expect(['next', 'goto', 'finish']).toContain(s.primary);
    }
  });

  it('goto steps carry a target tab', () => {
    for (const s of TOUR_STEPS) {
      if (s.primary === 'goto') expect(typeof s.tab).toBe('string');
    }
  });

  it('includes the add-plant step wired to plantAdded', () => {
    const plant = TOUR_STEPS.find((s) => s.id === 'plant');
    expect(plant).toBeTruthy();
    expect(plant.tab).toBe('plants');
    expect(plant.autoCompleteOn).toBe('plantAdded');
  });

  it('includes an optional first-measurement step right after the plant step', () => {
    const idx = TOUR_STEPS.findIndex((s) => s.id === 'log');
    expect(idx).toBe(TOUR_STEPS.findIndex((s) => s.id === 'plant') + 1);
    const log = TOUR_STEPS[idx];
    expect(log.tab).toBe('add-log');
    expect(log.optional).toBe(true);
    expect(log.autoCompleteOn).toBe('logAdded');
  });
});

describe('onboarding stepCompleted', () => {
  const plantStep = { autoCompleteOn: 'plantAdded' };
  const feedStep = { autoCompleteOn: 'scheduleAdded' };
  const logStep = { autoCompleteOn: 'logAdded' };
  const infoStep = { primary: 'next' };

  it('advances when the relevant collection grows', () => {
    expect(stepCompleted(plantStep, { plants: 0, schedules: 0 }, { plants: 1, schedules: 0 })).toBe(true);
    expect(stepCompleted(feedStep, { plants: 1, schedules: 0 }, { plants: 1, schedules: 1 })).toBe(true);
    expect(stepCompleted(logStep, { plants: 1, logs: 0, schedules: 0 }, { plants: 1, logs: 1, schedules: 0 })).toBe(true);
  });

  it('does not advance when the count is unchanged', () => {
    expect(stepCompleted(plantStep, { plants: 1, schedules: 0 }, { plants: 1, schedules: 0 })).toBe(false);
  });

  it('does not advance an unrelated collection', () => {
    expect(stepCompleted(plantStep, { plants: 1, schedules: 0 }, { plants: 1, schedules: 1 })).toBe(false);
  });

  it('returns false for steps with no auto-complete trigger', () => {
    expect(stepCompleted(infoStep, { plants: 0, schedules: 0 }, { plants: 1, schedules: 1 })).toBe(false);
  });
});
