import { describe, it, expect } from 'vitest';
import { totalGrowth, daysTracked, growthRate, currentHeight, latestLog, firstLog } from '../utils/stats';

const mk = (height, createdAt) => ({ height, created_at: createdAt });

describe('stats', () => {
  const logs = [
    mk(10, '2026-01-01T00:00:00.000Z'),
    mk(25, '2026-01-11T00:00:00.000Z'), // 10 days later
    mk(20, '2026-01-06T00:00:00.000Z'),
  ];

  it('orders first/latest by date regardless of input order', () => {
    expect(firstLog(logs).height).toBe(10);
    expect(latestLog(logs).height).toBe(25);
    expect(currentHeight(logs)).toBe(25);
  });

  it('totalGrowth is latest minus first height', () => {
    expect(totalGrowth(logs)).toBe(15);
  });

  it('daysTracked spans first to latest', () => {
    expect(daysTracked(logs)).toBe(10);
  });

  it('growthRate is growth per day', () => {
    expect(growthRate(logs)).toBe(1.5);
  });

  it('handles empty and single-log inputs safely', () => {
    expect(totalGrowth([])).toBe(0);
    expect(daysTracked([mk(5, '2026-01-01T00:00:00.000Z')])).toBe(0);
    expect(growthRate([])).toBe(0);
    expect(currentHeight([])).toBe(0);
  });
});
