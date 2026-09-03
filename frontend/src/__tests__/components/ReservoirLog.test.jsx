// MR-46: ReservoirLog shows when the reservoir was last fully changed and
// lets a user log new change/top-off events in the display volume unit.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils';
import ReservoirLog from '../../components/ReservoirLog';

const plant = { id: 1, name: 'Basil' };

let reservoirEvents = [];
let settings = { units: { length: 'cm', volume: 'gallons', temp: 'C' } };
const createReservoirEvent = vi.fn().mockResolvedValue({});
const deleteReservoirEvent = vi.fn().mockResolvedValue({});

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    settings,
    getPlantReservoirEvents: () => reservoirEvents,
    createReservoirEvent,
    deleteReservoirEvent,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn() }),
}));

function renderLog(now) {
  return renderWithProviders(<ReservoirLog plant={plant} now={now} />);
}

describe('ReservoirLog (MR-46)', () => {
  beforeEach(() => {
    reservoirEvents = [];
    settings = { units: { length: 'cm', volume: 'gallons', temp: 'C' } };
    createReservoirEvent.mockClear();
    deleteReservoirEvent.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('renders "Last full change: 3 days ago" for a change event 3 days before now', () => {
    const now = new Date(2026, 5, 4, 12, 0, 0); // Jun 4, 2026 12:00 local
    reservoirEvents = [
      { id: 1, plant_id: 1, date: '2026-06-01', kind: 'change', volume: 10, ec: null, ph: null, notes: '' },
    ];
    renderLog(now);
    expect(screen.getByText(/Last full change: 3 days ago/)).toBeInTheDocument();
  });

  it('renders "Last full change: never logged" when there are no change events', () => {
    reservoirEvents = [];
    renderLog(new Date());
    expect(screen.getByText('Last full change: never logged')).toBeInTheDocument();
  });

  it('submitting the add form with 5 gallons calls createReservoirEvent with volume 18.93', async () => {
    const user = userEvent.setup();
    renderLog(new Date());

    await user.type(screen.getByLabelText('Volume'), '5');
    await user.click(screen.getByRole('button', { name: 'Add event' }));

    expect(createReservoirEvent).toHaveBeenCalledTimes(1);
    const [payload] = createReservoirEvent.mock.calls[0];
    expect(payload.volume).toBeCloseTo(18.93, 2);
    expect(payload.plant_id).toBe(1);
    expect(payload.kind).toBe('change');
  });

  it('shows an inline error and does not submit when volume is empty', async () => {
    const user = userEvent.setup();
    renderLog(new Date());

    await user.click(screen.getByRole('button', { name: 'Add event' }));

    expect(createReservoirEvent).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a volume greater than 0/i)).toBeInTheDocument();
  });
});
