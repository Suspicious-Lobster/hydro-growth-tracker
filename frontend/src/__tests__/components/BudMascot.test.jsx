// MR-62: BudMascot subscribes to the bus and maps events to cues, passing
// them through BudRenderer. Mocks BudRenderer to a stub that records every
// prop set it was called with, so the last recorded cue is asserted directly
// rather than inferred from the DOM.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { emit, _reset } from '../../utils/budBus';
import { BUD_EVENTS } from '../../data/budCues';
import BudMascot from '../../components/Assistant/BudMascot';

let recorded = [];
vi.mock('../../components/Assistant/BudRenderer', () => ({
  default: (props) => {
    recorded.push(props);
    return <div data-testid="bud" />;
  },
}));

const plants = [];
const logs = [];
vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    getPlantLogs: () => [],
    getPlantReservoirEvents: () => [],
    schedules: [],
    logs,
    plants,
    loading: false,
  }),
}));

vi.mock('../../contexts/AssistantContext', () => ({
  useAssistant: () => ({
    effectsEnabled: true,
    muted: true, // avoid the 60s proactive-tip interval firing during the test
    soundEnabled: false,
    position: { right: 24, bottom: 24 },
    minimized: false,
    dismissedTipIds: [],
    lastShownAt: 0,
    setPosition: vi.fn(),
    setMinimized: vi.fn(),
    markShown: vi.fn(),
    dismissTip: vi.fn(),
    tourStep: null,
    tourDone: true, // skip the onboarding tour
    startTour: vi.fn(),
    setTourStep: vi.fn(),
    endTour: vi.fn(),
  }),
}));

function renderMascot() {
  return renderWithProviders(
    <BudMascot activeTab="dashboard" selectedPlant={null} onNavigate={() => {}} />
  );
}

describe('BudMascot cue mapping (MR-62)', () => {
  beforeEach(() => {
    _reset();
    recorded = [];
  });

  afterEach(() => {
    _reset();
  });

  it("maps form:reading {status:'out'} to the wince cue", () => {
    renderMascot();
    act(() => { emit(BUD_EVENTS.FORM_READING, { field: 'ph', value: 7.5, status: 'out' }); });
    const last = recorded[recorded.length - 1];
    expect(last.cue.name).toBe('wince');
  });

  it('maps save:ok to the cheer cue', () => {
    renderMascot();
    act(() => { emit(BUD_EVENTS.SAVE_OK, { kind: 'log' }); });
    const last = recorded[recorded.length - 1];
    expect(last.cue.name).toBe('cheer');
  });

  it('maps delete to the sulk cue', () => {
    renderMascot();
    act(() => { emit(BUD_EVENTS.DELETE, { kind: 'plant' }); });
    const last = recorded[recorded.length - 1];
    expect(last.cue.name).toBe('sulk');
  });

  it('two identical events 100ms apart yield two distinct cue.at stamps', async () => {
    vi.useFakeTimers();
    try {
      renderMascot();
      act(() => { emit(BUD_EVENTS.SAVE_OK, { kind: 'log' }); });
      const first = recorded[recorded.length - 1].cue.at;
      act(() => { vi.advanceTimersByTime(100); });
      act(() => { emit(BUD_EVENTS.SAVE_OK, { kind: 'log' }); });
      const second = recorded[recorded.length - 1].cue.at;
      expect(second).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});
