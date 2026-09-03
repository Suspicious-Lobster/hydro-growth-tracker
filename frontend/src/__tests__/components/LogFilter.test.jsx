// MR-43: LogViewer gains a filter toolbar; typing into the search box hides
// non-matching logs and updates the "Showing N of M" header count.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import LogViewer from '../../components/LogViewer';

const logs = [
  {
    id: 1, plant_id: 1, plant_name: 'Tomato', date: '2026-06-01', created_at: '2026-06-01T12:00:00.000Z',
    height: 10, ph: 6.0, ec: null, ppm: null, water_temp: null, air_temp: null, humidity: null,
    light_hours: null, reservoir_volume: null, nutrients: 'FloraGro', notes: '', image_url: null, growth_stage: null,
  },
  {
    id: 2, plant_id: 2, plant_name: 'Basil', date: '2026-06-02', created_at: '2026-06-02T12:00:00.000Z',
    height: 5, ph: null, ec: null, ppm: null, water_temp: null, air_temp: null, humidity: null,
    light_hours: null, reservoir_volume: null, nutrients: 'FloraBloom', notes: '', image_url: null, growth_stage: null,
  },
  {
    id: 3, plant_id: 1, plant_name: 'Tomato', date: '2026-06-03', created_at: '2026-06-03T12:00:00.000Z',
    height: 15, ph: null, ec: null, ppm: null, water_temp: null, air_temp: null, humidity: null,
    light_hours: null, reservoir_volume: null, nutrients: '', notes: '', image_url: null, growth_stage: null,
  },
];

const plants = [
  { id: 1, name: 'Tomato', species: 'tomato' },
  { id: 2, name: 'Basil', species: 'basil' },
];

const settings = { units: { length: 'cm', temp: 'C', volume: 'liters' } };
const updateLog = vi.fn().mockResolvedValue({});
const deleteLog = vi.fn().mockResolvedValue({});

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    plants,
    logs,
    settings,
    updateLog,
    deleteLog,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderViewer() {
  return render(
    <ThemeProvider>
      <LogViewer />
    </ThemeProvider>
  );
}

describe('LogViewer filtering (MR-43)', () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it('shows every log and the total count with no filter applied', () => {
    renderViewer();
    expect(screen.getByText('Total logs: 3')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3, name: 'Tomato' }).length).toBe(2);
    expect(screen.getByRole('heading', { level: 3, name: 'Basil' })).toBeInTheDocument();
  });

  it("typing 'basil' into the search box leaves only the basil log and updates the count", async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.type(screen.getByLabelText('Search logs'), 'basil');

    expect(screen.getByText('Showing 1 of 3 logs')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Basil' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Tomato' })).not.toBeInTheDocument();
  });

  it('an empty result shows the no-match message', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.type(screen.getByLabelText('Search logs'), 'nonexistent-plant-xyz');

    expect(screen.getByText('No logs match these filters')).toBeInTheDocument();
  });

  it('Clear filters restores the full list', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.type(screen.getByLabelText('Search logs'), 'basil');
    expect(screen.getByText('Showing 1 of 3 logs')).toBeInTheDocument();

    await user.click(screen.getByText('Clear filters'));

    expect(screen.getByText('Total logs: 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Basil' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3, name: 'Tomato' }).length).toBe(2);
  });

  it('exposes an accessible name for every toolbar control', () => {
    renderViewer();
    expect(screen.getByLabelText('Search logs')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by plant')).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by stage')).toBeInTheDocument();
    expect(screen.getByLabelText('Has measurement')).toBeInTheDocument();
  });
});
