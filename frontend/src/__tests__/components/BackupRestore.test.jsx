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
