import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { idealHeightAt, idealSeries } from '../utils/idealCurve';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import PlantDetail from '../components/PlantDetail';

describe('idealHeightAt', () => {
  it('day 0 is the seedling min-mid for tomato', () => {
    const h = idealHeightAt('tomato', 0);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(15);
  });

  it('day 40 is greater than day 20 (tomato keeps growing)', () => {
    expect(idealHeightAt('tomato', 40)).toBeGreaterThan(idealHeightAt('tomato', 20));
  });

  it('returns null for a species with no profile', () => {
    expect(idealHeightAt('not_a_real_species', 10)).toBeNull();
  });

  it('returns null for negative days', () => {
    expect(idealHeightAt('tomato', -1)).toBeNull();
  });
});

describe('idealSeries', () => {
  it('aligns each date to its ideal height', () => {
    const series = idealSeries('tomato', '2026-01-01', ['2026-01-01', '2026-01-11']);
    expect(series[0]).toBe(idealHeightAt('tomato', 0));
    expect(series[1]).toBe(idealHeightAt('tomato', 10));
  });

  it('returns null entries for an unknown species', () => {
    const series = idealSeries('not_a_real_species', '2026-01-01', ['2026-01-01']);
    expect(series).toEqual([null]);
  });
});

// PlantDetail render tests, following the harness pattern in vpd.test.js:
// ThemeProvider + ToastProvider, useAppData mocked, matchMedia + ResizeObserver stubbed.
const plantWithStart = {
  id: 1,
  name: 'Tomato',
  species: 'tomato',
  variety: '',
  system_type: '',
  reservoir_volume: null,
  start_date: '2026-01-01',
  target_stage: null,
};

const plantWithoutStart = {
  ...plantWithStart,
  start_date: null,
};

const logs = [
  {
    id: 1,
    plant_id: 1,
    date: '2026-01-01',
    height: 5,
    ph: null,
    ec: null,
    air_temp: null,
    humidity: null,
    growth_stage: 'seedling',
  },
  {
    id: 2,
    plant_id: 1,
    date: '2026-01-11',
    height: 12,
    ph: null,
    ec: null,
    air_temp: null,
    humidity: null,
    growth_stage: 'seedling',
  },
];

vi.mock('../contexts/AppDataContext', () => ({
  useAppData: () => ({
    schedules: [],
    settings: { units: { length: 'cm', volume: 'liters', temp: 'C' } },
    getPlantLogs: () => logs,
    getPlantReservoirEvents: () => [],
  }),
}));

describe('PlantDetail chart caption - Ideal (MR-48)', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    globalThis.ResizeObserver = globalThis.ResizeObserver || class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('shows the Ideal legend text when the plant has a start_date', () => {
    const { container } = render(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(ToastProvider, null, React.createElement(PlantDetail, { plant: plantWithStart, onBack: () => {} }))
      )
    );
    const chartWrapper = container.querySelector('[aria-label^="Growth"]');
    expect(chartWrapper).not.toBeNull();
    expect(chartWrapper.getAttribute('aria-label')).toContain('Ideal');
  });

  it('does not show the Ideal legend text without a start_date', () => {
    const { container } = render(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(ToastProvider, null, React.createElement(PlantDetail, { plant: plantWithoutStart, onBack: () => {} }))
      )
    );
    const chartWrapper = container.querySelector('[aria-label^="Growth"]');
    expect(chartWrapper).not.toBeNull();
    expect(chartWrapper.getAttribute('aria-label')).not.toContain('Ideal');
  });
});
