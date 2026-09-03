// MR-12: log editing must pick the plant from a selector (never re-send
// plant_name — a typo used to make the server silently fork a new plant),
// expose every measurement field for correction, and confirm deletes with an
// in-app ConfirmDialog instead of the blocking, unstyled window.confirm.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import LogViewer from '../../components/LogViewer';

const log = {
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
  doses: [{ name: 'Part A', ml_per_l: 2 }],
  notes: '',
  image_url: null,
  growth_stage: null,
};

const plants = [
  { id: 1, name: 'Tomato', species: 'tomato' },
  { id: 2, name: 'Basil', species: 'basil' },
];

let settings = { units: { length: 'cm', temp: 'C', volume: 'liters' } };
const updateLog = vi.fn().mockResolvedValue({});
const deleteLog = vi.fn().mockResolvedValue({});

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    plants,
    logs: [log],
    settings,
    updateLog,
    deleteLog,
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

function renderViewer() {
  return render(
    <ThemeProvider>
      <LogViewer />
    </ThemeProvider>
  );
}

describe('LogViewer editing (MR-12)', () => {
  beforeEach(() => {
    stubMatchMedia();
    settings = { units: { length: 'cm', temp: 'C', volume: 'liters' } };
    updateLog.mockClear();
    deleteLog.mockClear();
  });

  it('editing the plant + date + height sends plant_id (never plant_name)', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Edit'));

    const plantSelect = screen.getByDisplayValue('Tomato');
    await user.selectOptions(plantSelect, 'Basil');

    const dateInput = screen.getByDisplayValue('2026-06-10');
    fireEvent.change(dateInput, { target: { value: '2026-06-12' } });

    const heightInput = screen.getByDisplayValue('10');
    await user.clear(heightInput);
    await user.type(heightInput, '20');

    await user.click(screen.getByText('Save'));

    expect(updateLog).toHaveBeenCalledTimes(1);
    const [id, payload] = updateLog.mock.calls[0];
    expect(id).toBe(1);
    expect(payload).toMatchObject({ plant_id: 2, date: '2026-06-12', height: 20 });
    expect(payload).not.toHaveProperty('plant_name');
  });

  it('clearing pH and saving sends ph: null', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Edit'));

    const phInput = screen.getByDisplayValue('6');
    await user.clear(phInput);

    await user.click(screen.getByText('Save'));

    expect(updateLog).toHaveBeenCalledTimes(1);
    const [, payload] = updateLog.mock.calls[0];
    expect(payload.ph).toBeNull();
  });

  it('entering height 10 in inches sends height 25.4 cm', async () => {
    settings = { units: { length: 'in', temp: 'C', volume: 'liters' } };
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Edit'));

    // Prefill (10cm) is converted to inches (3.94in); overwrite with a known display value.
    const heightInput = screen.getByDisplayValue('3.94');
    await user.clear(heightInput);
    await user.type(heightInput, '10');

    await user.click(screen.getByText('Save'));

    expect(updateLog).toHaveBeenCalledTimes(1);
    const [, payload] = updateLog.mock.calls[0];
    expect(payload.height).toBeCloseTo(25.4, 5);
  });

  it('a log rendered with doses shows the text "2 ml/L"', () => {
    renderViewer();
    expect(screen.getByText(/2 ml\/L/)).toBeInTheDocument();
  });

  it('editing a log with doses shows the rows prefilled and saving sends them', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Edit'));

    expect(screen.getByLabelText('Dose name')).toHaveValue('Part A');
    expect(screen.getByLabelText('Dose ml/L')).toHaveValue(2);

    await user.click(screen.getByText('Save'));

    expect(updateLog).toHaveBeenCalledTimes(1);
    const [, payload] = updateLog.mock.calls[0];
    expect(payload.doses).toEqual([{ name: 'Part A', ml_per_l: 2 }]);
  });

  it('saving with empty nutrients and no doses succeeds (no nutrients-required toast)', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Edit'));

    const nutrientsInput = screen.getByDisplayValue('FloraGro');
    await user.clear(nutrientsInput);
    await user.click(screen.getByLabelText('Remove dose'));

    await user.click(screen.getByText('Save'));

    expect(toastError).not.toHaveBeenCalledWith('Nutrients are required');
    expect(updateLog).toHaveBeenCalledTimes(1);
  });

  it('delete uses ConfirmDialog, never window.confirm', async () => {
    window.confirm = vi.fn();
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Delete'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Delete this log');
    expect(window.confirm).toHaveBeenCalledTimes(0);

    await user.click(within(dialog).getByText('Delete'));

    expect(deleteLog).toHaveBeenCalledTimes(1);
    expect(deleteLog).toHaveBeenCalledWith(1);
    expect(window.confirm).toHaveBeenCalledTimes(0);
  });

  it('choosing a replacement photo sends the edit as FormData with the file (MR-51)', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Edit'));

    const file = new File(['data'], 'plant.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText('Replace photo');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    await user.click(screen.getByText('Save'));

    expect(updateLog).toHaveBeenCalledTimes(1);
    const [, payload] = updateLog.mock.calls[0];
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get('image')).toBe(file);
    expect(payload.get('height')).toBe('10');
  });

  it('cancelling the ConfirmDialog leaves deleteLog uncalled', async () => {
    window.confirm = vi.fn();
    const user = userEvent.setup();
    renderViewer();

    await user.click(screen.getByTitle('Delete'));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByText('Cancel'));

    expect(deleteLog).toHaveBeenCalledTimes(0);
    expect(window.confirm).toHaveBeenCalledTimes(0);
  });
});
