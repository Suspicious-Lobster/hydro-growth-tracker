import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { vpdKpa, vpdBand } from '../utils/vpd';
import { GROWTH_STAGES } from '../data/plantKnowledge';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import PlantDetail from '../components/PlantDetail';

describe('vpdKpa', () => {
  // NOTE on the board's stated acceptance value: MR-38 claims
  // `vpdKpa(25, 60)` should be "1.23 within 0.02". Working the Tetens formula
  // by hand with the spec's own -2C leaf offset:
  //   es(leaf=23) = 0.6108*exp(17.27*23/260.3) = 2.809437622397069
  //   es(air=25)  = 0.6108*exp(17.27*25/262.3) = 3.1677777175068473
  //   vpd = 2.809437622397069 - 3.1677777175068473*0.60 = 0.9087709918929605
  // That rounds to 0.91, not 1.23. (1.27 is the classic NO-offset value:
  // es(25)*(1-0.60) = 3.168*0.40 = 1.267 -> the brief appears to have quoted
  // the no-offset number while also specifying the -2C leaf offset be used.)
  // This test pins what the spec's own formula actually yields; see report
  // for the flagged discrepancy.
  it('computes VPD at 25C/60% with the -2C leaf offset', () => {
    expect(vpdKpa(25, 60)).toBeCloseTo(0.91, 2);
  });

  it('is null when a required input is missing', () => {
    expect(vpdKpa(25, null)).toBeNull();
    expect(vpdKpa(null, 60)).toBeNull();
  });
});

describe('vpdBand', () => {
  it('returns the vegetative band', () => {
    expect(vpdBand(GROWTH_STAGES.VEGETATIVE)).toEqual({ min: 0.8, max: 1.2 });
  });

  it('returns null for an unrecognized stage', () => {
    expect(vpdBand('not_a_stage')).toBeNull();
  });
});

// MR-38: PlantDetail's growth chart should surface a VPD series once logs
// carry air_temp + humidity. jsdom's ResponsiveContainer reports 0x0, so
// recharts' own <Legend/> text is not reliable to assert on in tests;
// GrowthChart instead builds a `chemLines` array that is the single source
// of truth for BOTH which <Line> elements it renders AND an aria-label/
// sr-only caption naming them (see GrowthChart.jsx), so removing the vpd
// entry removes it from the plotted chart and this caption together. This
// test asserts on that caption. No JSX here (this is a .js file) — using
// React.createElement instead.
const plant = {
  id: 1,
  name: 'Tomato',
  species: 'tomato',
  variety: '',
  system_type: '',
  reservoir_volume: null,
  start_date: null,
  target_stage: null,
};

const logsWithVpd = [
  {
    id: 1,
    plant_id: 1,
    date: '2026-01-01',
    height: 40,
    ph: null,
    ec: null,
    air_temp: 24,
    humidity: 55,
    growth_stage: 'vegetative',
  },
  {
    id: 2,
    plant_id: 1,
    date: '2026-01-02',
    height: 42,
    ph: null,
    ec: null,
    air_temp: 25,
    humidity: 60,
    growth_stage: 'vegetative',
  },
];

vi.mock('../contexts/AppDataContext', () => ({
  useAppData: () => ({
    schedules: [],
    settings: { units: { length: 'cm', volume: 'liters', temp: 'C' } },
    getPlantLogs: () => logsWithVpd,
    getPlantReservoirEvents: () => [],
  }),
}));

describe('PlantDetail chart caption - VPD (MR-38)', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    // jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one to
    // mount at all. Not needed by any other test file since this is the only
    // one that renders a chart component directly.
    globalThis.ResizeObserver = globalThis.ResizeObserver || class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('lists VPD alongside Growth/pH/EC once logs carry air_temp + humidity', () => {
    const { container } = render(
      React.createElement(
        ThemeProvider,
        null,
        // PlantDetail hosts ReservoirLog (MR-46), which toasts.
        React.createElement(ToastProvider, null, React.createElement(PlantDetail, { plant, onBack: () => {} }))
      )
    );
    const chartWrapper = container.querySelector('[aria-label^="Growth"]');
    expect(chartWrapper).not.toBeNull();
    expect(chartWrapper.getAttribute('aria-label')).toContain('VPD');
  });
});
