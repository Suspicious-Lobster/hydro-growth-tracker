// MR-47: fast entry for pH/EC/height without the full Add Log form. Asserts
// the unit-conversion payload (10in -> 25.4cm, mirroring AddLogForm's MR-25
// test) and that a blank height is blocked by the shared validator before
// createLog is ever called.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils';
import QuickLogForm from '../../components/QuickLogForm';

const plants = [
  { id: 1, name: 'Tomato', species: 'tomato' },
  { id: 2, name: 'Basil', species: 'basil' },
];
let settings = { units: { length: 'in', temp: 'C', volume: 'liters' } };
const createLog = vi.fn().mockResolvedValue({});

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    plants,
    settings,
    createLog,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn() }),
}));

function renderForm() {
  return renderWithProviders(<QuickLogForm />);
}

describe('QuickLogForm (MR-47)', () => {
  beforeEach(() => {
    settings = { units: { length: 'in', temp: 'C', volume: 'liters' } };
    createLog.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('converts height to cm and submits ph/ec/plant/date', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByRole('combobox', { name: /quick log plant/i }), '2');

    const heightInput = screen.getByRole('spinbutton', { name: /quick height/i });
    await user.clear(heightInput);
    await user.type(heightInput, '10');

    await user.type(screen.getByRole('spinbutton', { name: /quick ph/i }), '6.0');
    await user.type(screen.getByRole('spinbutton', { name: /quick ec/i }), '1.2');

    await user.click(screen.getByRole('button', { name: /quick log/i }));

    expect(createLog).toHaveBeenCalledTimes(1);
    const [body] = createLog.mock.calls[0];
    expect(body.height).toBeCloseTo(25.4, 5);
    expect(body.ph).toBe(6);
    expect(body.ec).toBe(1.2);
    expect(body.plant_id).toBe(2);
    const { todayLocalISO } = await import('../../utils/dates');
    expect(body.date).toBe(todayLocalISO());
    expect(toastSuccess).toHaveBeenCalledWith('Logged');
  });

  it('blocks submit with the shared validator message when height is blank', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /quick log/i }));

    expect(createLog).not.toHaveBeenCalled();
    expect(screen.getByText(/height is required/i)).toBeInTheDocument();
  });
});
