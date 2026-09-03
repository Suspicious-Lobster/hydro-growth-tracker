// MR-42: the dashboard summary row (next feeding / latest reading / alerts /
// harvest countdown), built from existing pure helpers. `now` is injected so
// the overdue-feeding scenario is pinned instead of racing the real clock.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import Dashboard from '../../components/PlantCards';
import { feedingStatus } from '../../utils/feeding';

const now = new Date('2026-06-10T12:00:00');

const plants = [
  { id: 1, name: 'Overdue Tomato', species: 'tomato' },
  { id: 2, name: 'High pH Basil', species: 'tomato' },
];

const logsByPlant = {
  1: [{ id: 1, plant_id: 1, date: '2026-06-01', height: 20, ph: 6.0 }],
  2: [{ id: 2, plant_id: 2, date: '2026-06-08', height: 20, ph: 7.5 }],
};

// last_fed 3 days before `now`, on a 'daily' schedule -> overdue.
const schedules = [
  { id: 1, plant_id: 1, frequency: 'daily', last_fed: '2026-06-07T12:00:00', active: true },
];

// Mutable so individual tests can swap the fixture without re-mocking the
// module (ESM imports are cached; vi.doMock mid-file wouldn't take effect
// for an already-resolved static import).
const appData = {
  plants,
  schedules,
  settings: { units: { length: 'cm', temp: 'C' } },
  getPlantLogs: (plant) => logsByPlant[plant.id] || [],
};

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => appData,
}));

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderDashboard() {
  return render(
    <ThemeProvider>
      <Dashboard onSelectPlant={() => {}} now={now} />
    </ThemeProvider>
  );
}

describe('DashboardWidgets (MR-42)', () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it('precondition: the schedule is actually overdue at `now`', () => {
    // CODING-PRACTICES 1.3: assert the fixture produces the condition the
    // test claims to exercise, not just the UI outcome.
    expect(feedingStatus(schedules[0], now).overdue).toBe(true);
  });

  it('shows the overdue feeding schedule and its plant name', () => {
    renderDashboard();
    const tile = screen.getByTestId('widget-feeding');
    expect(tile.textContent).toContain('overdue');
    expect(tile.textContent).toContain('Overdue Tomato');
  });

  it('counts an out-of-range tomato log (pH 7.5) as one alert', () => {
    renderDashboard();
    const tile = screen.getByTestId('widget-alerts');
    expect(within(tile).getByText('1')).toBeInTheDocument();
  });

  it('shows a days-based harvest countdown for a late-flowering log', () => {
    const lateLogsByPlant = {
      1: [{ id: 1, plant_id: 1, date: '2026-06-01', height: 20, growth_stage: 'late_flowering' }],
    };
    const original = { ...appData };
    Object.assign(appData, {
      plants: [plants[0]],
      schedules: [],
      getPlantLogs: (plant) => lateLogsByPlant[plant.id] || [],
    });
    try {
      renderDashboard();
      const tile = screen.getByTestId('widget-harvest');
      expect(tile.textContent).toMatch(/days/);
    } finally {
      Object.assign(appData, original);
    }
  });

  it('does not render the widget row in the no-plants empty state', () => {
    const original = { ...appData };
    Object.assign(appData, {
      plants: [],
      schedules: [],
      getPlantLogs: () => [],
    });
    try {
      renderDashboard();
      expect(screen.queryByTestId('widget-feeding')).not.toBeInTheDocument();
    } finally {
      Object.assign(appData, original);
    }
  });
});
