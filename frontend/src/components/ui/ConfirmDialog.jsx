import React from 'react';
import Modal from './Modal';
import { useTheme } from '../../contexts/ThemeContext';

// Shared in-app replacement for window.confirm() on destructive actions.
// window.confirm blocks the renderer and can't be styled or tested — every
// other destructive action already uses Modal, so this reuses it too.
const ConfirmDialog = ({ title, message, confirmLabel = 'Delete', danger = true, busy = false, onConfirm, onCancel }) => {
  const { colors } = useTheme();

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-4">
        <p className={colors.text}>{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg border ${colors.border} disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-lg font-medium text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
