import { describe, it, expect } from 'vitest';
import { feedingStatus, intervalDays, dueCount } from '../utils/feeding';
import { stageToWeek, FEEDING_SCHEDULE } from '../data/feedingSchedule';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe('feeding status', () => {
  it('computes interval from frequency', () => {
    expect(intervalDays({ frequency: 'daily' })).toBe(1);
    expect(intervalDays({ frequency: 'weekly' })).toBe(7);
    expect(intervalDays({ frequency: 'custom', custom_interval_days: 3 })).toBe(3);
  });

  it('flags overdue schedules', () => {
    const s = { frequency: 'daily', last_fed: daysAgo(3) };
    const st = feedingStatus(s);
    expect(st.due).toBe(true);
    expect(st.overdue).toBe(true);
  });

  it('does not flag freshly-fed schedules', () => {
    const s = { frequency: 'weekly', last_fed: daysAgo(1) };
    expect(feedingStatus(s).due).toBe(false);
  });

  it('counts due active schedules only', () => {
    const schedules = [
      { frequency: 'daily', last_fed: daysAgo(2), active: true },
      { frequency: 'weekly', last_fed: daysAgo(1), active: true },
      { frequency: 'daily', last_fed: daysAgo(5), active: false },
    ];
    expect(dueCount(schedules)).toBe(1);
  });
});

describe('feeding schedule data', () => {
  it('has 16 weeks', () => expect(FEEDING_SCHEDULE.length).toBe(16));
  it('maps stages to a representative week', () => {
    expect(stageToWeek('seedling')).toBe(3);
    expect(stageToWeek('vegetative')).toBe(6);
    expect(stageToWeek('mid_flowering')).toBe(11);
    expect(stageToWeek(undefined)).toBe(6);
  });
});
