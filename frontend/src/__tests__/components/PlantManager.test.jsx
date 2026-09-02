// MR-25: PlantManager's create / archive / show-archived / restore / delete
// flows were previously unverified except by hand.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import api from '../../api/api';
import PlantManager from '../../components/PlantManager';

vi.mock('../../api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiErrorMessage: (err, fallback) => err?.message || fallback,
}));

const plants = [{ id: 1, name: 'Tomato', species: 'tomato' }];
const settings = { units: { length: 'cm', temp: 'C', volume: 'liters' } };
const createPlant = vi.fn().mockResolvedValue({ id: 2 });
const updatePlant = vi.fn().mockResolvedValue({});
const archivePlant = vi.fn().mockResolvedValue({});
const deletePlant = vi.fn().mockResolvedValue({});
const refresh = vi.fn().mockResolvedValue({});

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    plants,
    settings,
    getPlantLogs: () => [],
    createPlant,
    updatePlant,
    archivePlant,
    deletePlant,
    refresh,
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

function renderManager() {
  return render(
    <ThemeProvider>
      <PlantManager onSelectPlant={() => {}} />
    </ThemeProvider>
  );
}

describe('PlantManager (MR-25)', () => {
  beforeEach(() => {
    stubMatchMedia();
    api.get.mockReset();
    api.post.mockReset();
    createPlant.mockClear();
    updatePlant.mockClear();
    archivePlant.mockClear();
    deletePlant.mockClear();
    refresh.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('Add Plant creates the plant and toasts success', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole('button', { name: /add plant/i }));
    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByPlaceholderText(/tomato plant/i);
    await user.type(nameInput, 'Chili');
    await user.click(within(dialog).getByRole('button', { name: /add plant/i }));

    await waitFor(() => expect(createPlant).toHaveBeenCalledTimes(1));
    expect(createPlant.mock.calls[0][0]).toMatchObject({ name: 'Chili' });
    expect(toastSuccess).toHaveBeenCalledWith('Added "Chili"');
  });

  it('Archive button archives the plant by id', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByTitle('Archive'));

    expect(archivePlant).toHaveBeenCalledTimes(1);
    expect(archivePlant).toHaveBeenCalledWith(1);
  });

  it('Show archived fetches and renders the archived plant', async () => {
    api.get.mockResolvedValue({ data: [{ id: 3, name: 'Old Basil', archived: true }] });
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByText('Show archived'));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/plants?archived=true'));
    expect(await screen.findByText('Old Basil')).toBeInTheDocument();
  });

  it('Restore posts to the restore endpoint then refreshes', async () => {
    api.get.mockResolvedValue({ data: [{ id: 3, name: 'Old Basil', archived: true }] });
    api.post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByText('Show archived'));
    await screen.findByText('Old Basil');

    await user.click(screen.getByTitle('Restore'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/plants/3/restore'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Delete requires the confirm modal before deletePlant is called', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByTitle('Delete'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Permanently delete');
    expect(deletePlant).toHaveBeenCalledTimes(0);

    await user.click(within(dialog).getByText('Delete Permanently'));

    await waitFor(() => expect(deletePlant).toHaveBeenCalledTimes(1));
    expect(deletePlant).toHaveBeenCalledWith(1);
  });
});
