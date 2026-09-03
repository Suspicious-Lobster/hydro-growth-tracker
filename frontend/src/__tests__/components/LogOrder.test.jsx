// MR-10: a backdated log must render its own entered date, not the server
// insert time. LogViewer and PlantDetail's history table both derive their
// displayed date from log.date, falling back to log.created_at only when the
// user never supplied one.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { ToastProvider } from '../../contexts/ToastContext';
import LogViewer from '../../components/LogViewer';
import PlantDetail from '../../components/PlantDetail';

const todayIso = new Date().toISOString();

const backdatedLog = {
  id: 1,
  plant_id: 1,
  plant_name: 'Tomato',
  date: '2020-01-01',
  created_at: todayIso,
  height: 10,
  height_unit: 'cm',
  ph: null,
  ec: null,
  ppm: null,
  water_temp: null,
  air_temp: null,
  humidity: null,
  light_hours: null,
  nutrients: 'FloraGro',
  notes: '',
  image_url: null,
  growth_stage: null,
};

const plant = {
  id: 1,
  name: 'Tomato',
  species: '',
  variety: '',
  system_type: '',
  reservoir_volume: null,
  start_date: null,
  target_stage: null,
};

const settings = { units: { length: 'cm', volume: 'liters', temp: 'C' }, ppm_scale: 500 };

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    logs: [backdatedLog],
    plants: [plant],
    schedules: [],
    settings,
    getPlantLogs: () => [backdatedLog],
    getPlantReservoirEvents: () => [],
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
  }),
}));

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('log date ordering/display (MR-10)', () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it('LogViewer renders the entered date (2020), not the insert date', () => {
    const { container } = render(
      <ThemeProvider>
        <ToastProvider>
          <LogViewer />
        </ToastProvider>
      </ThemeProvider>
    );
    expect(container.textContent).toContain('2020');
  });

  it("PlantDetail's history table shows the entered date (2020) for the same log", () => {
    // PlantDetail hosts ReservoirLog (MR-46), which toasts, so it needs the provider.
    render(
      <ThemeProvider>
        <ToastProvider>
          <PlantDetail plant={plant} onBack={() => {}} />
        </ToastProvider>
      </ThemeProvider>
    );
    expect(screen.getByText('Measurement history').closest('div').textContent).toContain('2020');
  });
});
