// MR-44: feeding reminders fire a desktop notification once per day for a
// due schedule, respect the enabled toggle, and don't fire for a schedule
// fed today. Also proves the main.js/package.json AppUserModelId parity and
// the SettingsPanel toggle (SettingsPanel.test.jsx belongs to an earlier
// row and isn't touched here — this second describe block covers the new
// toggle instead).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFeedingReminders } from '../hooks/useFeedingReminders';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AssistantProvider } from '../contexts/AssistantContext';
import SettingsPanel from '../components/SettingsPanel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only the third describe block (the SettingsPanel toggle) renders
// SettingsPanel, which also pulls in AppDataContext/ToastContext/api; stub
// those so it mounts cleanly with a real AssistantProvider underneath.
const panelSettings = { units: { length: 'cm', temp: 'C', volume: 'liters' }, ppm_scale: 500, default_species: null };
vi.mock('../contexts/AppDataContext', () => ({
  useAppData: () => ({ settings: panelSettings, updateSettings: vi.fn().mockResolvedValue({}) }),
}));
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));
vi.mock('../api/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiErrorMessage: (err, fallback) => err?.message || fallback,
}));

function makeSchedule(overrides = {}) {
  return {
    id: 'sched-1',
    plant_name: 'Basil',
    nutrient_type: 'Grow A+B',
    frequency: 'daily',
    active: true,
    last_fed: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('useFeedingReminders', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('notifies once for a schedule fed 2 days ago on a daily cadence', () => {
    const notify = vi.fn();
    // "now" is 2 days after last_fed, well past the daily cadence.
    const now = () => new Date('2026-01-03T08:00:00.000Z');
    const schedule = makeSchedule({ last_fed: '2026-01-01T08:00:00.000Z' });

    renderHook(() => useFeedingReminders({ schedules: [schedule], enabled: true, now, notify }));

    expect(notify).toHaveBeenCalledTimes(1);
    const [title] = notify.mock.calls[0];
    expect(title).toContain('Basil');
  });

  it('does not notify again on a second render the same day', () => {
    const notify = vi.fn();
    const now = () => new Date('2026-01-03T08:00:00.000Z');
    const schedule = makeSchedule({ last_fed: '2026-01-01T08:00:00.000Z' });

    // First mount fires once and records today's reminder in localStorage.
    const first = renderHook(() => useFeedingReminders({ schedules: [schedule], enabled: true, now, notify }));
    expect(notify).toHaveBeenCalledTimes(1);
    first.unmount();

    // A brand-new mount (e.g. app reopened, or the interval firing again) on
    // the same day must see the 'hydro.reminded' record and stay quiet.
    renderHook(() => useFeedingReminders({ schedules: [schedule], enabled: true, now, notify }));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('never notifies when enabled is false', () => {
    const notify = vi.fn();
    const now = () => new Date('2026-01-03T08:00:00.000Z');
    const schedule = makeSchedule({ last_fed: '2026-01-01T08:00:00.000Z' });

    renderHook(() => useFeedingReminders({ schedules: [schedule], enabled: false, now, notify }));

    expect(notify).not.toHaveBeenCalled();
  });

  it('does not notify a schedule fed today', () => {
    const notify = vi.fn();
    const now = () => new Date('2026-01-01T20:00:00.000Z');
    const schedule = makeSchedule({ last_fed: '2026-01-01T08:00:00.000Z' });

    renderHook(() => useFeedingReminders({ schedules: [schedule], enabled: true, now, notify }));

    expect(notify).not.toHaveBeenCalled();
  });
});

describe('main.js / package.json AppUserModelId parity (MR-44)', () => {
  it('setAppUserModelId argument equals build.appId', () => {
    const mainJs = fs.readFileSync(path.resolve(__dirname, '../../../main.js'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'));

    const match = mainJs.match(/app\.setAppUserModelId\(\s*['"]([^'"]+)['"]\s*\)/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe(pkg.build.appId);
  });
});

// SettingsPanel.test.jsx (a different row) mocks useAssistant without
// remindersEnabled/setRemindersEnabled; the panel must default the toggle to
// checked in that case. Here we render with a real AssistantProvider so the
// toggle's own behavior is proven end to end.
describe('SettingsPanel feeding reminders toggle (MR-44)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it('flips aria-checked when clicked', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <AssistantProvider>
          <SettingsPanel />
        </AssistantProvider>
      </ThemeProvider>
    );

    const toggle = screen.getByRole('switch', { name: 'Feeding reminders' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
