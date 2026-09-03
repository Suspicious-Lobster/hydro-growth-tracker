// MR-28: Modal must trap focus (Tab wraps within the dialog, Shift+Tab wraps
// backwards), move focus inside itself on open, restore focus to the opener on
// close, and still close on Escape.
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils';
import Modal from '../../components/ui/Modal';

// Harness: an "opener" button outside the modal (to prove focus returns to it),
// plus a Modal containing three focusable buttons so the trap has something
// non-trivial to wrap around.
const Harness = ({ onClose }) => {
  const [open, setOpen] = useState(true);
  const close = () => { setOpen(false); onClose?.(); };
  return (
    <div>
      <button>Opener</button>
      {open && (
        <Modal title="Test Modal" onClose={close}>
          <button>First</button>
          <button>Second</button>
          <button>Third</button>
        </Modal>
      )}
    </div>
  );
};

const renderHarness = (onClose) => renderWithProviders(
  <Harness onClose={onClose} />,
);

describe('Modal accessibility', () => {
  it('moves focus inside the dialog on open', () => {
    renderHarness();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('wraps focus from the last control to the first on Tab', async () => {
    const user = userEvent.setup();
    renderHarness();
    const third = screen.getByRole('button', { name: 'Third' });
    third.focus();
    expect(document.activeElement).toBe(third);

    await user.tab();

    // First focusable inside the dialog is the Close button (it comes before
    // First/Second/Third in DOM order).
    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    expect(document.activeElement).toBe(closeButton);
  });

  it('wraps focus from the first control to the last on Shift+Tab', async () => {
    const user = userEvent.setup();
    renderHarness();
    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    await user.tab({ shift: true });

    const third = screen.getByRole('button', { name: 'Third' });
    expect(document.activeElement).toBe(third);
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    renderHarness(onClose);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('restores focus to the opener when the modal unmounts', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Opener';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = renderWithProviders(
      <Modal title="Test Modal" onClose={() => {}}>
        <button>Only</button>
      </Modal>,
    );
    expect(document.activeElement).not.toBe(opener);

    unmount();
    expect(document.activeElement).toBe(opener);
    document.body.removeChild(opener);
  });
});
