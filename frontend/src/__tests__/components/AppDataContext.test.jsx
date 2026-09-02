// MR-13: mutations must refresh AppDataContext's data in the background
// instead of flipping `loading` back to true. Flipping `loading` on a
// refresh is exactly what used to unmount the visible view (App.jsx renders
// a full-screen spinner while `loading` is true), wiping any local state the
// view held (PlantManager's archived list, LogViewer's scroll position,
// Bud's position, etc). This test reproduces that pattern with a small
// harness that mirrors App.jsx's `{loading ? <Spinner/> : <View/>}` branch.
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppDataProvider, useAppData } from '../../contexts/AppDataContext';
import api from '../../api/api';

vi.mock('../../api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiErrorMessage: (err, fallback) => err?.message || fallback,
}));

const samplePlants = [{ id: 1, name: 'Basil' }];
const sampleLogs = [];
const sampleSchedules = [];
const sampleSettings = {
  units: { length: 'cm', volume: 'liters', temp: 'C' },
  ppm_scale: 500,
  default_species: null,
};

function mockHappyLoad() {
  api.get.mockImplementation((url) => {
    if (url === '/plants') return Promise.resolve({ data: samplePlants });
    if (url === '/logs') return Promise.resolve({ data: sampleLogs });
    if (url === '/feeding') return Promise.resolve({ data: sampleSchedules });
    if (url === '/settings') return Promise.resolve({ data: sampleSettings });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
}

// A view holding local state (a counter, standing in for e.g. PlantManager's
// archived list or LogViewer's scroll position) plus a mutation trigger.
function ProbeView() {
  const { error, createPlant } = useAppData();
  const [count, setCount] = useState(0);

  return (
    <div data-testid="probe">
      <span data-testid="error">{error || ''}</span>
      <span data-testid="count">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}>increment</button>
      <button onClick={() => createPlant({ name: 'New Plant' })}>create</button>
    </div>
  );
}

// Mirrors App.jsx's content-area branch: spinner while `loading`, otherwise
// the view. `refreshing` is exposed alongside for assertions.
function Harness() {
  const { loading, refreshing } = useAppData();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="refreshing">{String(refreshing)}</span>
      {loading ? <div data-testid="spinner">Loading...</div> : <ProbeView />}
    </div>
  );
}

function renderHarness() {
  return render(
    <AppDataProvider>
      <Harness />
    </AppDataProvider>
  );
}

describe('AppDataContext background refresh (MR-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the spinner on the initial load only, then refreshes in the background keeping the same view instance and its local state', async () => {
    mockHappyLoad();
    renderHarness();

    // Initial load: the spinner is up, loading is true.
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();

    const probeEl = screen.getByTestId('probe');

    // Give the view local state, like a user scrolling or expanding a list.
    await userEvent.click(screen.getByText('increment'));
    expect(screen.getByTestId('count').textContent).toBe('1');

    // Hold the refetch's /plants response so we can observe `refreshing`
    // mid-flight without a race against it resolving instantly.
    let resolvePlants;
    api.post.mockResolvedValue({ data: { id: 2, name: 'New Plant' } });
    api.get.mockImplementation((url) => {
      if (url === '/plants') {
        return new Promise((resolve) => {
          resolvePlants = () => resolve({ data: samplePlants });
        });
      }
      if (url === '/logs') return Promise.resolve({ data: sampleLogs });
      if (url === '/feeding') return Promise.resolve({ data: sampleSchedules });
      if (url === '/settings') return Promise.resolve({ data: sampleSettings });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    });

    await userEvent.click(screen.getByText('create'));

    await waitFor(() => expect(screen.getByTestId('refreshing').textContent).toBe('true'));

    // The core assertion: a background refresh must NOT flip `loading` back
    // to true, so the spinner never replaces the view and the exact same
    // element instance stays mounted with its local state intact.
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('probe')).toBe(probeEl);
    expect(screen.getByTestId('count').textContent).toBe('1');

    resolvePlants();
    await waitFor(() => expect(screen.getByTestId('refreshing').textContent).toBe('false'));

    expect(screen.getByTestId('probe')).toBe(probeEl);
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('keeps the last good data and surfaces the error when a background refresh fails', async () => {
    mockHappyLoad();
    renderHarness();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await userEvent.click(screen.getByText('increment'));
    expect(screen.getByTestId('count').textContent).toBe('1');

    api.post.mockResolvedValue({ data: { id: 2, name: 'New Plant' } });
    api.get.mockImplementation((url) => {
      if (url === '/plants') return Promise.reject(new Error('network down'));
      if (url === '/logs') return Promise.resolve({ data: sampleLogs });
      if (url === '/feeding') return Promise.resolve({ data: sampleSchedules });
      if (url === '/settings') return Promise.resolve({ data: sampleSettings });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    });

    await userEvent.click(screen.getByText('create'));

    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('network down'));

    // Failed refresh: no spinner, no unmount, last good data (the view and
    // its local state) survives.
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('refreshing').textContent).toBe('false');
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });
});
