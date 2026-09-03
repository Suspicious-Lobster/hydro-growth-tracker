import { describe, it, expect } from 'vitest';
import { BADGES, earnedBadges, newlyEarned } from '../utils/achievements';

const logsOf = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({
  height: 10 + i,
  date: `2026-01-${String((i % 27) + 1).padStart(2, '0')}`,
  created_at: `2026-01-${String((i % 27) + 1).padStart(2, '0')}T00:00:00Z`,
  ...extra,
}));

describe('achievements.earnedBadges', () => {
  it('earns ten_logs but not hundred_logs at exactly 10 logs', () => {
    const ids = earnedBadges({ plants: [], logs: logsOf(10) });
    expect(ids).toContain('ten_logs');
    expect(ids).not.toContain('hundred_logs');
  });

  it('earns hundred_logs at 100 logs', () => {
    const ids = earnedBadges({ plants: [], logs: logsOf(100) });
    expect(ids).toContain('hundred_logs');
  });

  it('earns first_plant once a plant exists', () => {
    const ids = earnedBadges({ plants: [{ id: 1 }], logs: [] });
    expect(ids).toContain('first_plant');
  });

  it('earns first_log on the first log', () => {
    const ids = earnedBadges({ plants: [], logs: logsOf(1) });
    expect(ids).toContain('first_log');
  });

  it('earns first_harvest from a harvest_ready log', () => {
    const logs = [{ height: 90, date: '2026-01-01', growth_stage: 'harvest_ready' }];
    const ids = earnedBadges({ plants: [], logs });
    expect(ids).toContain('first_harvest');
  });

  it('does not earn first_harvest without a harvest_ready log', () => {
    const ids = earnedBadges({ plants: [], logs: logsOf(5) });
    expect(ids).not.toContain('first_harvest');
  });

  it('earns photo_fan at 10 logs with an image_url', () => {
    const logs = logsOf(10, { image_url: 'x.jpg' });
    const ids = earnedBadges({ plants: [], logs });
    expect(ids).toContain('photo_fan');
  });

  it('does not earn photo_fan when fewer than 10 logs have photos', () => {
    const logs = [...logsOf(9, { image_url: 'x.jpg' }), ...logsOf(5)];
    const ids = earnedBadges({ plants: [], logs });
    expect(ids).not.toContain('photo_fan');
  });

  it('earns chemist at 20 logs with both ph and ec', () => {
    const logs = logsOf(20, { ph: 6.0, ec: 1.2 });
    const ids = earnedBadges({ plants: [], logs });
    expect(ids).toContain('chemist');
  });

  it('does not earn chemist when ec is missing', () => {
    const logs = logsOf(20, { ph: 6.0 });
    const ids = earnedBadges({ plants: [], logs });
    expect(ids).not.toContain('chemist');
  });

  it('earns streak_7 via careStreak on 7 consecutive daily logs', () => {
    const now = new Date('2026-01-10T12:00:00Z').getTime();
    const logs = ['04', '05', '06', '07', '08', '09', '10'].map((d) => ({
      height: 10, date: `2026-01-${d}`, created_at: `2026-01-${d}T00:00:00Z`,
    }));
    const ids = earnedBadges({ plants: [], logs }, now);
    expect(ids).toContain('streak_7');
    expect(ids).not.toContain('streak_30');
  });

  it('returns ids in BADGES order', () => {
    const logs = logsOf(10, { ph: 6.0, ec: 1.2, image_url: 'x.jpg' });
    const ids = earnedBadges({ plants: [{ id: 1 }], logs });
    const order = BADGES.map((b) => b.id);
    const filtered = order.filter((id) => ids.includes(id));
    expect(ids).toEqual(filtered);
  });
});

describe('achievements.newlyEarned', () => {
  it('returns only the ids newly present, in BADGES order', () => {
    expect(newlyEarned(['first_log'], ['first_log', 'ten_logs'])).toEqual(['ten_logs']);
  });

  it('returns an empty array when nothing new was earned', () => {
    expect(newlyEarned(['first_log', 'ten_logs'], ['first_log', 'ten_logs'])).toEqual([]);
  });

  it('handles multiple simultaneous new badges in BADGES order', () => {
    const result = newlyEarned([], ['ten_logs', 'first_log', 'first_plant']);
    expect(result).toEqual(['first_plant', 'first_log', 'ten_logs']);
  });
});
