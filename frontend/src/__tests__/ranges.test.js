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
    // air_temp/humidity moved from 22C/65% to 25C/60% for MR-38: once a vpd
    // check is added, 22C/65% yields vpd 0.62 kPa, below the vegetative band
    // (0.8-1.2, warn-margin down to 0.7) and would itself flag an alert.
    // 25C/60% yields vpd 0.91 kPa (in-band) while staying within tomato's
    // optimal air-temp (18-26) and humidity (60-70) ranges too.
    const log = { ph: 6.0, humidity: 60, air_temp: 25 };
    const alerts = measurementAlerts(log, 'tomato', GROWTH_STAGES.VEGETATIVE);
    expect(alerts.length).toBe(0);
  });

  it('ignores missing measurements', () => {
    expect(measurementAlerts({}, 'tomato', GROWTH_STAGES.VEGETATIVE)).toEqual([]);
  });
});

describe('measurementAlerts - vpd (MR-38)', () => {
  it('flags an out-of-range VPD for a vegetative log at 30C/30% humidity', () => {
    const log = { air_temp: 30, humidity: 30 };
    const alerts = measurementAlerts(log, 'tomato', GROWTH_STAGES.VEGETATIVE);
    expect(alerts.some((a) => a.key === 'vpd' && a.status === 'out')).toBe(true);
  });

  it('produces no vpd alert for an in-band vegetative log', () => {
    // NOTE: the board's stated example ("a log at 24C/65% produces none") is
    // wrong once actually computed: vpdKpa(24, 65) = 0.70 kPa, which falls
    // inside the vegetative band's warn margin (0.8-1.2, margin down to 0.7)
    // and so DOES produce a 'warn' alert, contradicting "none". 25C/60%
    // (vpdKpa = 0.91 kPa) is genuinely inside the 0.8-1.2 band and produces
    // no alert at all; used here instead. See report for the flagged
    // discrepancy.
    const log = { air_temp: 25, humidity: 60 };
    const alerts = measurementAlerts(log, 'tomato', GROWTH_STAGES.VEGETATIVE);
    expect(alerts.some((a) => a.key === 'vpd')).toBe(false);
  });

  it('skips the vpd check when stage is unknown', () => {
    const log = { air_temp: 30, humidity: 30 };
    const alerts = measurementAlerts(log, 'tomato', null);
    expect(alerts.some((a) => a.key === 'vpd')).toBe(false);
  });
});
