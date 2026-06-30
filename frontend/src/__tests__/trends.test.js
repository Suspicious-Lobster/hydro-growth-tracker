import { describe, it, expect } from 'vitest';
import { phTrend, growthStall, strongGrowth, isHarvestWindow } from '../utils/trends';

const log = (date, fields) => ({ date, created_at: `${date}T00:00:00Z`, ...fields });
const PH_RANGE = { min: 5.8, max: 6.2 };

describe('trends.phTrend', () => {
  it('flags a steady rise heading out of the ideal band', () => {
    const logs = [log('2026-01-01', { ph: 6.0 }), log('2026-01-03', { ph: 6.3 }), log('2026-01-05', { ph: 6.6 })];
    const t = phTrend(logs, PH_RANGE);
    expect(t).toMatchObject({ dir: 'rising', leaving: true });
    expect(t.value).toBe(6.6);
  });

  it('reports direction without "leaving" when still comfortably in range', () => {
    const logs = [log('2026-01-01', { ph: 5.6 }), log('2026-01-03', { ph: 5.8 }), log('2026-01-05', { ph: 6.0 })];
    const t = phTrend(logs, PH_RANGE);
    expect(t.dir).toBe('rising');
    expect(t.leaving).toBe(false);
  });

  it('returns null for noisy / non-monotonic pH', () => {
    const logs = [log('2026-01-01', { ph: 6.0 }), log('2026-01-03', { ph: 5.9 }), log('2026-01-05', { ph: 6.1 })];
    expect(phTrend(logs, PH_RANGE)).toBeNull();
  });

  it('returns null with fewer than 3 readings', () => {
    expect(phTrend([log('2026-01-01', { ph: 6.0 }), log('2026-01-03', { ph: 6.5 })], PH_RANGE)).toBeNull();
  });
});

describe('trends.growthStall', () => {
  it('flags flat height across >=5 days', () => {
    const logs = [log('2026-01-01', { height: 10 }), log('2026-01-04', { height: 10.2 }), log('2026-01-07', { height: 10.3 })];
    expect(growthStall(logs)).toMatchObject({ days: 6 });
  });

  it('returns null while the plant is still growing', () => {
    const logs = [log('2026-01-01', { height: 10 }), log('2026-01-04', { height: 14 }), log('2026-01-07', { height: 20 })];
    expect(growthStall(logs)).toBeNull();
  });
});

describe('trends.strongGrowth', () => {
  it('praises vigorous growth (>=1.5 cm/day)', () => {
    const logs = [log('2026-01-01', { height: 5 }), log('2026-01-11', { height: 35 })];
    expect(strongGrowth(logs).rate).toBeGreaterThanOrEqual(1.5);
  });

  it('returns null for modest growth', () => {
    const logs = [log('2026-01-01', { height: 5 }), log('2026-01-11', { height: 8 })];
    expect(strongGrowth(logs)).toBeNull();
  });
});

describe('trends.isHarvestWindow', () => {
  it('is true in late flowering and harvest', () => {
    expect(isHarvestWindow('late_flowering')).toBe(true);
    expect(isHarvestWindow('harvest_ready')).toBe(true);
  });
  it('is false earlier in the lifecycle', () => {
    expect(isHarvestWindow('vegetative')).toBe(false);
    expect(isHarvestWindow(null)).toBe(false);
  });
});
