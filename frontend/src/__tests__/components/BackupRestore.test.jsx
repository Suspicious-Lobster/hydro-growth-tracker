// MR-25: BackupRestore's confirm-gated restore flow was previously
// unverified except by hand. Proves the file-pick step only stages a
// preview (no request) and the destructive POST only fires after the
// explicit "Replace all data" confirmation.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import api from '../../api/api';
import BackupRestore from '../../components/BackupRestore';

vi.mock('../../api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiErrorMessage: (err, fallback) => err?.message || fallback,
}));

const downloadBlob = vi.fn();
vi.mock('../../utils/download', () => ({
  downloadBlob: (...args) => downloadBlob(...args),
}));

const refresh = vi.fn().mockResolvedValue({});
vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({ refresh }),
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

const ENVELOPE = {
  _type: 'hydro-growth-tracker-backup',
  data: {
    plants: [{ id: 1 }, { id: 2 }],
    logs: [{ id: 1 }, { id: 2 }, { id: 3 }],
    schedules: [{ id: 1 }],
  },
};

function makeBackupFile() {
  const file = new File([JSON.stringify(ENVELOPE)], 'backup.json', { type: 'application/json' });
  // jsdom's File may lack .text(); polyfill on the instance if so.
  if (typeof file.text !== 'function') {
    file.text = () => Promise.resolve(JSON.stringify(ENVELOPE));
  }
  return file;
}

function renderPanel() {
  return render(
    <ThemeProvider>
      <BackupRestore />
    </ThemeProvider>
  );
}

async function pickFile() {
  const input = document.querySelector('input[type="file"]');
  const file = makeBackupFile();
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

describe('BackupRestore (MR-25)', () => {
  beforeEach(() => {
    stubMatchMedia();
    api.get.mockReset();
    api.post.mockReset();
    downloadBlob.mockClear();
    refresh.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('choosing a file shows the counts preview and does not post', async () => {
    renderPanel();

    await pickFile();

    expect(await screen.findByText(/The backup contains 2 plants, 3 logs/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("clicking 'Replace all data' posts once and shows the restored counts", async () => {
    api.post.mockResolvedValue({ data: { counts: { plants: 2, logs: 3, schedules: 1 } } });
    const user = userEvent.setup();
    renderPanel();

    await pickFile();
    await screen.findByText(/The backup contains 2 plants, 3 logs/);

    await user.click(screen.getByRole('button', { name: /replace all data/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/backup/restore', ENVELOPE);
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Restored 2 plants, 3 logs, 1 schedules')
    );
  });

  it('Cancel leaves api.post uncalled', async () => {
    const user = userEvent.setup();
    renderPanel();

    await pickFile();
    await screen.findByText(/The backup contains 2 plants, 3 logs/);

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(api.post).not.toHaveBeenCalled();
  });
});

// MR-54: the zip variant carries photos. Download hits /backup/zip; restore
// stages the file, then posts it as multipart only after confirmation.
describe('BackupRestore zip (MR-54)', () => {
  beforeEach(() => {
    stubMatchMedia();
    api.get.mockReset();
    api.post.mockReset();
    downloadBlob.mockClear();
    toastSuccess.mockClear();
  });

  it("'Download backup with photos' fetches /backup/zip and saves a .zip", async () => {
    api.get.mockResolvedValue({ data: new Blob(['PK']) });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /download backup with photos/i }));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/backup/zip', { responseType: 'blob' }));
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(downloadBlob.mock.calls[0][0]).toMatch(/^hydro_backup_\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it('picking a zip stages it without posting; confirming posts multipart to /backup/restore/zip', async () => {
    api.post.mockResolvedValue({ data: { counts: { plants: 1, logs: 2, schedules: 0, photos: 1 } } });
    const user = userEvent.setup();
    renderPanel();

    const input = screen.getByTestId('zip-input');
    const file = new File(['PK'], 'photos.zip', { type: 'application/zip' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText(/checks every file in the zip/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /replace all data/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe('/backup/restore/zip');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('archive')).toBeInstanceOf(File);
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Restored 1 plants, 2 logs, 0 schedules, 1 photos')
    );
  });
});

// MR-55: CSV import asks the server for a dry run first, shows the summary,
// and only posts dryRun:false after confirmation; errors disable the commit.
describe('BackupRestore CSV import (MR-55)', () => {
  beforeEach(() => {
    stubMatchMedia();
    api.post.mockReset();
    toastSuccess.mockClear();
    refresh.mockClear();
  });

  const pickCsv = (text) => {
    const input = screen.getByTestId('csv-input');
    const file = new File([text], 'logs.csv', { type: 'text/csv' });
    if (typeof file.text !== 'function') file.text = () => Promise.resolve(text);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
  };

  it('shows the dry-run summary, then confirm posts dryRun:false', async () => {
    api.post
      .mockResolvedValueOnce({ data: { dryRun: true, rows: 3, valid: 3, errors: [], newPlants: ['Tomato'] } })
      .mockResolvedValueOnce({ data: { created: { logs: 3, plants: 1 } } });
    const user = userEvent.setup();
    renderPanel();

    pickCsv('plant,date,height\nTomato,2026-06-01,5\n');

    expect(await screen.findByText(/3 valid/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe('/logs/import');
    expect(api.post.mock.calls[0][1]).toMatchObject({ dryRun: true });

    await user.click(screen.getByRole('button', { name: /import 3 logs/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[1][1]).toMatchObject({ dryRun: false, csv: 'plant,date,height\nTomato,2026-06-01,5\n' });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Imported 3 logs and 1 new plants'));
    expect(refresh).toHaveBeenCalled();
  });

  it('a dry run with errors lists them by line and disables the import button', async () => {
    api.post.mockResolvedValueOnce({ data: { dryRun: true, rows: 2, valid: 1, errors: [{ line: 3, messages: ['pH must be between 0 and 14'] }], newPlants: [] } });
    renderPanel();

    pickCsv('plant,date,height,ph\nB,2026-06-01,5,6\nB,2026-06-02,5,15\n');

    expect(await screen.findByText(/Line 3: pH must be between 0 and 14/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import 1 logs/i })).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
