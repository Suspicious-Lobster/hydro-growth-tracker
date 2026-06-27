import { describe, it, expect } from 'vitest';
import { formatLength, formatTemp, formatVolume, toCm, toCelsius, toLiters, fromCm } from '../utils/format';

describe('format (display)', () => {
  it('formats length per unit', () => {
    expect(formatLength(10, 'cm')).toBe('10 cm');
    expect(formatLength(2.54, 'in')).toBe('1 in');
    expect(formatLength(null, 'cm')).toBe('—');
  });

  it('formats temperature per unit', () => {
    expect(formatTemp(20, 'C')).toBe('20°C');
    expect(formatTemp(0, 'F')).toBe('32°F');
    expect(formatTemp('', 'C')).toBe('—');
  });

  it('formats volume per unit', () => {
    expect(formatVolume(10, 'liters')).toBe('10 L');
    expect(formatVolume(1, 'gallons')).toBe('0.3 gal');
  });
});

describe('format (canonical conversion)', () => {
  it('converts display input to canonical', () => {
    expect(toCm(1, 'in')).toBeCloseTo(2.54);
    expect(toCm(5, 'cm')).toBe(5);
    expect(toCelsius(32, 'F')).toBeCloseTo(0);
    expect(toLiters(1, 'gallons')).toBeCloseTo(3.785, 2);
  });

  it('round-trips length', () => {
    expect(fromCm(toCm(10, 'in'), 'in')).toBeCloseTo(10);
  });
});
