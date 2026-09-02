// MR-25: cover the unit-conversion payload and the draft save/restore flow
// on AddLogForm by hand only until now. This test asserts the *converted*
// payload (10in -> 25.4cm) and the localStorage draft round-trip.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import AddLogForm from '../../components/AddLogForm';

const plants = [{ id: 1, name: 'Tomato', species: 'tomato' }];
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

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderForm() {
  return render(
    <ThemeProvider>
      <AddLogForm />
    </ThemeProvider>
  );
}

describe('AddLogForm (MR-25)', () => {
  beforeEach(() => {
    stubMatchMedia();
    localStorage.clear();
    settings = { units: { length: 'in', temp: 'C', volume: 'liters' } };
    createLog.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('converts 10 in to 25.4 cm in the createLog payload', async () => {
    const user = userEvent.setup();
    renderForm();

    const plantSelect = screen.getAllByRole('combobox').find((el) => el.querySelector('option[value="1"]'));
    await user.selectOptions(plantSelect, '1');

    const heightInput = screen.getByPlaceholderText('0.0');
    await user.clear(heightInput);
    await user.type(heightInput, '10');

    const nutrientsInput = screen.getByPlaceholderText(/General Hydroponics/i);
    await user.type(nutrientsInput, 'GH');

    await user.click(screen.getByRole('button', { name: /add growth log/i }));

    expect(createLog).toHaveBeenCalledTimes(1);
    const [body] = createLog.mock.calls[0];
    expect(body.height).toBeCloseTo(25.4, 5);
    expect(body.plant_id).toBe(1);
  });

  it('saves a draft of the nutrients field and restores it on remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderForm();

    const nutrientsInput = screen.getByPlaceholderText(/General Hydroponics/i);
    await user.type(nutrientsInput, 'draft text');

    expect(screen.getByText('Draft saved')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('logFormDraft')).nutrients).toBe('draft text');

    unmount();
    cleanup();

    renderForm();
    expect(screen.getByPlaceholderText(/General Hydroponics/i)).toHaveValue('draft text');
    expect(screen.getByText('Draft saved')).toBeInTheDocument();
  });

  it('Clear button empties the field and removes the draft key', async () => {
    const user = userEvent.setup();
    renderForm();

    const nutrientsInput = screen.getByPlaceholderText(/General Hydroponics/i);
    await user.type(nutrientsInput, 'draft text');
    expect(localStorage.getItem('logFormDraft')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /^clear$/i }));

    expect(screen.getByPlaceholderText(/General Hydroponics/i)).toHaveValue('');
    expect(localStorage.getItem('logFormDraft')).toBeNull();
  });
});
