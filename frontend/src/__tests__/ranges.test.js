import { describe, it, expect } from 'vitest';
import { classify, measurementAlerts } from '../utils/ranges';
import { GROWTH_STAGES } from '../data/plantKnowledge';

describe('classify', () => {
  const range = { min: 5.5, max: 6.5 };
  it('marks in-range as ok', () => expect(classify(6.0, range)).toBe('ok'));
  it('marks just-outside as warn', () => expect(classify(6.55, range)).toBe('warn'));
  it('marks far-outside as out', () => expect(classify(8, range)).toBe('out'));
  it('marks missing as unknown', () => {
    expect(classify(null, range)).toBe('unknown');
    expect(classify(6, undefined)).toBe('unknown');
  });
});

describe('measurementAlerts', () => {
  it('flags out-of-range pH for the species', () => {
    // Tomato pH range is 5.8-6.2.
    const log = { ph: 7.5 };
    const alerts = measurementAlerts(log, 'tomato', GROWTH_STAGES.VEGETATIVE);
    expect(alerts.some((a) => a.key === 'ph' && a.status === 'out')).toBe(true);
  });

  it('produces no alerts when readings are in range', () => {
    const log = { ph: 6.0, humidity: 65, air_temp: 22 };
    const alerts = measurementAlerts(log, 'tomato', GROWTH_STAGES.VEGETATIVE);
    expect(alerts.length).toBe(0);
  });

  it('ignores missing measurements', () => {
    expect(measurementAlerts({}, 'tomato', GROWTH_STAGES.VEGETATIVE)).toEqual([]);
  });
});
