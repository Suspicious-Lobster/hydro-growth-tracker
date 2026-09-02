// MR-33: the frontend must import the server's validation.js rather than
// re-implementing any of its rules or bounds (CODING-PRACTICES 5.4: one
// derivation per fact). This test proves the import resolves to the exact
// same module (identity, not a copy) and that AddLogForm shows the server's
// own message inline, without ever making a request for an invalid value.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as viaAlias from '@shared/validation';
import * as viaPath from '../../../validation.js';
import { ThemeProvider } from '../contexts/ThemeContext';
import AddLogForm from '../components/AddLogForm';

describe('validateLog: single source of truth', () => {
  it('the alias and the root file resolve to the identical exported function', () => {
    expect(viaAlias.validateLog).toBe(viaPath.validateLog);
    expect(viaAlias.validateLogByField).toBe(viaPath.validateLogByField);
  });

  it('validateLogByField reports the exact message validateLog produces, for the same input', () => {
    const base = {
      plant_id: 1,
      date: '2024-01-01',
      height: 10,
      nutrients: 'GH',
      ph: 15,
    };
    const flat = viaPath.validateLog(base, { requireDate: true });
    const phMessage = flat.find((m) => m.startsWith('pH'));
    expect(phMessage).toBeTruthy();

    const byField = viaPath.validateLogByField(base, { requireDate: true });
    expect(byField.ph).toBe(phMessage);
  });
});

const plants = [{ id: 1, name: 'Tomato', species: 'tomato' }];
const settings = {
  units: { length: 'cm', temp: 'C', volume: 'liters' },
};

const createLog = vi.fn();

vi.mock('../contexts/AppDataContext', () => ({
  useAppData: () => ({
    plants,
    settings,
    createLog,
  }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}));

function renderForm() {
  return render(
    <ThemeProvider>
      <AddLogForm />
    </ThemeProvider>
  );
}

describe('AddLogForm: inline validation from the shared validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it('shows the server\'s exact pH message inline with no request, then posts once a valid value is entered', async () => {
    renderForm();
    const user = userEvent.setup();

    const plantSelect = screen.getAllByRole('combobox').find((el) => el.querySelector('option[value="1"]'));
    await user.selectOptions(plantSelect, '1');

    const heightInput = screen.getByPlaceholderText('0.0');
    await user.clear(heightInput);
    await user.type(heightInput, '10');

    const nutrientsInput = screen.getByPlaceholderText(/General Hydroponics/i);
    await user.type(nutrientsInput, 'GH');

    const phInput = screen.getByPlaceholderText('5.5–6.5');
    await user.type(phInput, '15');

    const submitBtn = screen.getByRole('button', { name: /add growth log/i });
    await user.click(submitBtn);

    const expectedPhMessage = viaPath.validateLogByField(
      { plant_id: 1, date: '2024-01-01', height: 10, nutrients: 'GH', ph: 15 },
      { requireDate: true }
    ).ph;

    await waitFor(() => expect(screen.getByText(expectedPhMessage)).toBeInTheDocument());
    expect(createLog).toHaveBeenCalledTimes(0);

    await user.clear(phInput);
    await user.type(phInput, '6');
    await user.click(submitBtn);

    await waitFor(() => expect(createLog).toHaveBeenCalledTimes(1));
    const [body] = createLog.mock.calls[0];
    expect(body.ph).toBe(6);
    expect(body.height).toBe(10);
  });
});
