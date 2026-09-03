// MR-25: SettingsPanel's save flow was previously unverified except by
// hand. Proves changing the length unit to 'in' and saving sends that unit
// through updateSettings and re-renders the length select as 'in'.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils';
import SettingsPanel from '../../components/SettingsPanel';

const settings = {
  units: { length: 'cm', temp: 'C', volume: 'liters' },
  ppm_scale: 500,
  default_species: null,
};
const updateSettings = vi.fn().mockResolvedValue({});

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({ settings, updateSettings }),
}));

vi.mock('../../contexts/AssistantContext', () => ({
  useAssistant: () => ({
    effectsEnabled: true,
    muted: false,
    soundEnabled: true,
    toggleEffects: vi.fn(),
    setMuted: vi.fn(),
    setSoundEnabled: vi.fn(),
    resetDismissed: vi.fn(),
    startTour: vi.fn(),
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn() }),
}));

// SettingsPanel renders BackupRestore + AboutDialog too; stub the api module
// they depend on so those subtrees mount cleanly without real requests.
vi.mock('../../api/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiErrorMessage: (err, fallback) => err?.message || fallback,
}));

function renderPanel() {
  return renderWithProviders(<SettingsPanel />);
}

describe('SettingsPanel (MR-25)', () => {
  beforeEach(() => {
    updateSettings.mockClear();
    toastSuccess.mockClear();
  });

  it('saves the length unit change and re-renders it', async () => {
    const user = userEvent.setup();
    renderPanel();

    const lengthSelect = screen.getByDisplayValue('Centimeters (cm)');
    await user.selectOptions(lengthSelect, 'in');
    expect(screen.getByDisplayValue('Inches (in)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    const [payload] = updateSettings.mock.calls[0];
    expect(payload.units.length).toBe('in');
    expect(toastSuccess).toHaveBeenCalledWith('Settings saved');
    expect(screen.getByDisplayValue('Inches (in)')).toBeInTheDocument();
  });

  // MR-53: nutrient prices are edited as rows and saved with the rest.
  it('adds a nutrient price row and saves it as nutrient_prices', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /add nutrient price/i }));
    await user.type(screen.getByLabelText('Nutrient name'), 'Part A');
    await user.type(screen.getByLabelText('Price per liter'), '30');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    const [payload] = updateSettings.mock.calls[0];
    expect(payload.nutrient_prices).toEqual([{ name: 'Part A', price_per_liter: 30 }]);
  });
});
