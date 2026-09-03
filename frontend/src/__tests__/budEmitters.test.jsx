// MR-63: after MR-62 the bus existed but nothing in components emitted on
// it. This covers the emit side: AddLogForm/QuickLogForm readings + saves,
// LogViewer deletes, and App tab changes — all observed on the real bus
// (subscribe('*')) with the real AppDataProvider driven by a mocked api
// module, rather than mocking the context itself, so App's tab test can
// share the same setup and go through a real click.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils';
import { subscribe, _reset } from '../utils/budBus';
import { PLANT_PROFILES, PLANT_TYPES } from '../data/plantKnowledge';
import { AppDataProvider, useAppData } from '../contexts/AppDataContext';
import AddLogForm from '../components/AddLogForm';
import QuickLogForm from '../components/QuickLogForm';
import LogViewer from '../components/LogViewer';
import App from '../App';

// Mutable fixture the mocked api reads from; vi.mock is hoisted above this
// file's top-level code, so the data it serves must come from a vi.hoisted
// container (a plain `let` here would be seen as undefined inside the
// factory).
const dataStore = vi.hoisted(() => ({
  plants: [{ id: 1, name: 'Tomato', species: 'tomato' }],
  logs: [],
  schedules: [],
  settings: { units: { length: 'cm', temp: 'C', volume: 'liters' }, ppm_scale: 500, default_species: null },
  reservoir: [],
}));
const apiSpies = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), delete: vi.fn() }));

vi.mock('../api/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/plants') return Promise.resolve({ data: dataStore.plants });
      if (url === '/logs') return Promise.resolve({ data: dataStore.logs });
      if (url === '/feeding') return Promise.resolve({ data: dataStore.schedules });
      if (url === '/settings') return Promise.resolve({ data: dataStore.settings });
      if (url === '/reservoir') return Promise.resolve({ data: dataStore.reservoir });
      if (url === '/') return Promise.resolve({ data: { status: 'ok', damaged: null } });
      return Promise.reject(new Error(`unmocked GET ${url}`));
    }),
    post: apiSpies.post,
    put: apiSpies.put,
    delete: apiSpies.delete,
  },
  apiErrorMessage: (err, fallback) => err?.message || fallback,
  fetchBackendStatus: async () => ({ status: 'ok', damaged: null }),
  resolveImageUrl: (u) => u,
  API_BASE_URL: 'http://localhost',
  API_TOKEN: null,
}));

// CODING-PRACTICES 1.3: assert the precondition the 'out'/'ok' pH assertions
// below depend on, so a change to tomato's band doesn't make this test lie.
describe('precondition: tomato pH band', () => {
  it('is 5.8-6.2', () => {
    expect(PLANT_PROFILES[PLANT_TYPES.TOMATO].phRange).toEqual({ min: 5.8, max: 6.2 });
  });
});

let events;
function record() {
  events = [];
  return subscribe('*', (payload, type) => events.push({ type, payload }));
}

// Delays mounting `children` until AppDataProvider's initial load resolves,
// so a component reading `plants` at first render (e.g. QuickLogForm's
// `useState(plants[0]?.id ?? '')`) sees the loaded data, not the empty
// pre-load default.
function Gate({ children }) {
  const { loading } = useAppData();
  return loading ? null : children;
}

function renderWithData(ui) {
  return renderWithProviders(
    <AppDataProvider><Gate>{ui}</Gate></AppDataProvider>
  );
}

beforeEach(() => {
  _reset();
  record();
  dataStore.plants = [{ id: 1, name: 'Tomato', species: 'tomato' }];
  dataStore.logs = [];
  dataStore.schedules = [];
  dataStore.reservoir = [];
  apiSpies.post.mockReset().mockResolvedValue({ data: { id: 2 } });
  apiSpies.put.mockReset().mockResolvedValue({ data: {} });
  apiSpies.delete.mockReset().mockResolvedValue({ data: {} });
});

afterEach(() => {
  _reset();
});

describe('AddLogForm bud emits (MR-63)', () => {
  it("typing 7.5 into pH with a tomato plant selected emits a final form:reading of status 'out'", async () => {
    const user = userEvent.setup();
    renderWithData(<AddLogForm defaultPlantId={1} />);

    await waitFor(() => expect(screen.getByLabelText('Plant')).toHaveValue('1'));

    const phInput = screen.getByPlaceholderText('5.5–6.5');
    await user.clear(phInput);
    await user.type(phInput, '7.5');

    await waitFor(() => {
      const reading = [...events].reverse().find((e) => e.type === 'form:reading' && e.payload.field === 'ph');
      expect(reading).toBeTruthy();
      expect(reading.payload.status).toBe('out');
    }, { timeout: 2000 });
  });

  it('typing 6.0 into pH with a tomato plant selected emits a final form:reading of status ok', async () => {
    const user = userEvent.setup();
    renderWithData(<AddLogForm defaultPlantId={1} />);

    await waitFor(() => expect(screen.getByLabelText('Plant')).toHaveValue('1'));

    const phInput = screen.getByPlaceholderText('5.5–6.5');
    await user.clear(phInput);
    await user.type(phInput, '6.0');

    await waitFor(() => {
      const reading = [...events].reverse().find((e) => e.type === 'form:reading' && e.payload.field === 'ph');
      expect(reading).toBeTruthy();
      expect(reading.payload.status).toBe('ok');
    }, { timeout: 2000 });
  });
});

describe('QuickLogForm bud emits (MR-63)', () => {
  it('a successful QuickLog submit emits save:ok {kind: "log"}', async () => {
    const user = userEvent.setup();
    renderWithData(<QuickLogForm />);

    const heightInput = await screen.findByRole('spinbutton', { name: /quick height/i });
    await user.clear(heightInput);
    await user.type(heightInput, '10');

    await user.click(screen.getByRole('button', { name: /quick log/i }));

    await waitFor(() => {
      const saveOk = events.find((e) => e.type === 'save:ok');
      expect(saveOk).toBeTruthy();
      expect(saveOk.payload).toEqual({ kind: 'log' });
    });
  });
});

describe('LogViewer bud emits (MR-63)', () => {
  beforeEach(() => {
    dataStore.logs = [{
      id: 1,
      plant_id: 1,
      plant_name: 'Tomato',
      date: '2026-06-10',
      created_at: '2026-06-10T12:00:00.000Z',
      height: 10,
      ph: 6.0,
      ec: null,
      ppm: null,
      water_temp: null,
      air_temp: null,
      humidity: null,
      light_hours: null,
      reservoir_volume: null,
      nutrients: 'FloraGro',
      doses: [],
      notes: '',
      image_url: null,
      growth_stage: null,
    }];
  });

  it('confirming a delete emits delete {kind: "log"}', async () => {
    const user = userEvent.setup();
    renderWithData(<LogViewer />);

    await user.click(await screen.findByTitle('Delete'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByText('Delete'));

    await waitFor(() => {
      const del = events.find((e) => e.type === 'delete');
      expect(del).toBeTruthy();
      expect(del.payload).toEqual({ kind: 'log' });
    });
  });
});

describe('App bud emits (MR-63)', () => {
  it('switching to the Settings tab emits tab {tab: "settings"}', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    await waitFor(() => {
      const tabEvent = events.find((e) => e.type === 'tab');
      expect(tabEvent).toBeTruthy();
      expect(tabEvent.payload).toEqual({ tab: 'settings' });
    });
  });
});
