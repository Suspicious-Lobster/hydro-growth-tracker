// MR-66: typing a free-text question into the AskMenu and pressing Enter
// should land the answer in the speech bubble. Mirrors BudMascot.test.jsx's
// mocking style (BudRenderer stubbed, AppDataContext/AssistantContext mocked)
// but drives the real DOM through user interaction instead of the bus.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, fireEvent } from '../../test-utils';
import BudMascot from '../../components/Assistant/BudMascot';

vi.mock('../../components/Assistant/BudRenderer', () => ({
  default: () => <div data-testid="bud" />,
}));

const plant = { id: 1, name: 'Tomato', species: 'tomato', target_stage: null };
const logs = [{ id: 1, plant_id: 1, date: '2026-01-01', ph: 7.1, height: 10 }];

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    getPlantLogs: () => logs,
    getPlantReservoirEvents: () => [],
    schedules: [],
    logs,
    plants: [plant],
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
    tourDone: true,
    startTour: vi.fn(),
    setTourStep: vi.fn(),
    endTour: vi.fn(),
    voice: 'towelie',
  }),
}));

function renderMascot() {
  return renderWithProviders(
    <BudMascot activeTab="dashboard" selectedPlant={plant} onNavigate={() => {}} />
  );
}

describe('BudChat: typing a question into AskMenu (MR-66)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('opens the menu, types a question, and renders the answer in the bubble on Enter', () => {
    renderMascot();
    act(() => {
      fireEvent.click(screen.getByLabelText('Bud the assistant — click to ask, drag to move'));
    });

    const input = screen.getByLabelText('Ask Bud anything');
    act(() => {
      fireEvent.change(input, { target: { value: "what's my ph" } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    const bubble = screen.getByRole('status');
    expect(bubble.textContent).toContain('7.1');
  });

  it('does nothing on Enter with an empty question', () => {
    renderMascot();
    act(() => {
      fireEvent.click(screen.getByLabelText('Bud the assistant — click to ask, drag to move'));
    });
    const input = screen.getByLabelText('Ask Bud anything');
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
