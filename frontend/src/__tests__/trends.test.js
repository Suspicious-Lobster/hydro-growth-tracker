import { describe, it, expect } from 'vitest';
import { phTrend, ecTrend, driftAlerts, growthStall, strongGrowth, isHarvestWindow, harvestCountdown, careStreak } from '../utils/trends';

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

describe('trends.ecTrend', () => {
  const EC_RANGE = { min: 0.8, max: 1.4 };

  it('flags a steady rise heading out of the EC band', () => {
    const logs = [log('2026-01-01', { ec: 1.0 }), log('2026-01-03', { ec: 1.2 }), log('2026-01-05', { ec: 1.5 })];
    const t = ecTrend(logs, EC_RANGE);
    expect(t).toMatchObject({ dir: 'rising', leaving: true });
  });

  it('returns null for noisy / non-monotonic EC', () => {
    const logs = [log('2026-01-01', { ec: 1.0 }), log('2026-01-03', { ec: 1.1 }), log('2026-01-05', { ec: 1.0 })];
    expect(ecTrend(logs, EC_RANGE)).toBeNull();
  });

  it('returns null with fewer than 3 readings', () => {
    expect(ecTrend([log('2026-01-01', { ec: 1.0 }), log('2026-01-03', { ec: 1.5 })], EC_RANGE)).toBeNull();
  });
});

describe('trends.driftAlerts', () => {
  const PH_RANGE = { min: 5.8, max: 6.2 };
  const EC_RANGE = { min: 0.8, max: 1.4 };

  it('flags two consecutive out-of-band pH readings with no clean trend', () => {
    const logs = [log('2026-01-01', { ph: 6.9 }), log('2026-01-03', { ph: 7.0 })];
    const alerts = driftAlerts(logs, { phRange: PH_RANGE });
    expect(alerts).toEqual([{ key: 'ph', dir: 'high', value: 7, min: 5.8, max: 6.2 }]);
  });

  it('flags a leaving EC trend even while still technically in-band', () => {
    const logs = [log('2026-01-01', { ec: 1.0 }), log('2026-01-03', { ec: 1.2 }), log('2026-01-05', { ec: 1.4 })];
    const alerts = driftAlerts(logs, { ecRange: EC_RANGE });
    expect(alerts).toEqual([{ key: 'ec', dir: 'rising', value: 1.4, min: 0.8, max: 1.4 }]);
  });

  it('emits at most one entry per key', () => {
    const logs = [log('2026-01-01', { ph: 6.9 }), log('2026-01-03', { ph: 7.0 }), log('2026-01-05', { ph: 7.1 })];
    const alerts = driftAlerts(logs, { phRange: PH_RANGE });
    expect(alerts.filter((a) => a.key === 'ph')).toHaveLength(1);
  });

  it('returns nothing for in-band, non-drifting readings', () => {
    const logs = [log('2026-01-01', { ph: 6.0 }), log('2026-01-03', { ph: 6.0 }), log('2026-01-05', { ph: 6.0 })];
    expect(driftAlerts(logs, { phRange: PH_RANGE })).toEqual([]);
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

describe('trends.harvestCountdown', () => {
  // Local midnight, like the logs' date-only strings, so the arithmetic is
  // exact in every timezone (a UTC-midnight `now` was off by the zone offset).
  const day = (d) => new Date(2026, 0, d).getTime();

  it('counts down from the first late-flowering log (default 21 days)', () => {
    const logs = [
      log('2026-01-01', { growth_stage: 'mid_flowering' }),
      log('2026-01-05', { growth_stage: 'late_flowering' }),
    ];
    // 10 days into a 21-day late-flower window -> ~11 days left
    const hc = harvestCountdown(logs, 'generic', day(15));
    expect(hc.ready).toBe(false);
    expect(hc.days).toBe(11);
  });

  it('is ready once the estimate reaches zero', () => {
    const logs = [log('2026-01-01', { growth_stage: 'late_flowering' })];
    expect(harvestCountdown(logs, 'generic', day(25))).toMatchObject({ ready: true, days: 0 });
  });

  it('is ready immediately when a harvest-stage log exists', () => {
    const logs = [log('2026-01-01', { growth_stage: 'harvest_ready' })];
    expect(harvestCountdown(logs, 'generic', day(2))).toMatchObject({ ready: true, days: 0 });
  });

  it('returns null before late flowering is ever logged', () => {
    const logs = [log('2026-01-01', { growth_stage: 'vegetative' })];
    expect(harvestCountdown(logs, 'generic', day(2))).toBeNull();
  });
});

describe('trends.careStreak', () => {
  // Noon LOCAL on Jan 10: in UTC+13 a noon-UTC instant is already Jan 11.
  const now = new Date(2026, 0, 10, 12).getTime();

  it('counts consecutive logging days ending today', () => {
    const logs = [log('2026-01-08', {}), log('2026-01-09', {}), log('2026-01-10', {})];
    expect(careStreak(logs, now)).toBe(3);
  });

  it("doesn't break the streak before today's log is in (anchors on yesterday)", () => {
    const logs = [log('2026-01-07', {}), log('2026-01-08', {}), log('2026-01-09', {})];
    expect(careStreak(logs, now)).toBe(3);
  });

  it('resets across a gap', () => {
    const logs = [log('2026-01-05', {}), log('2026-01-06', {}), log('2026-01-09', {}), log('2026-01-10', {})];
    expect(careStreak(logs, now)).toBe(2);
  });

  it('is zero when the latest log is older than yesterday', () => {
    const logs = [log('2026-01-05', {}), log('2026-01-06', {})];
    expect(careStreak(logs, now)).toBe(0);
  });
});
