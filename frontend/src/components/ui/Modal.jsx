import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Elements that count as "focusable" for the purposes of the Tab trap. Mirrors the
// common focusable-selector list; excludes disabled controls and tabindex="-1".
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Reusable modal dialog. Replaces the hand-rolled fixed-overlay markup that was
// duplicated across PlantManager, FeedingSchedule and the calculator.
const Modal = ({ title, onClose, children, maxWidth = 'max-w-2xl' }) => {
  const { colors } = useTheme();
  const dialogRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`).current;

  // On mount: remember what had focus, move focus inside the dialog. On unmount:
  // restore focus to the opener (if it's still attached to the document).
  useEffect(() => {
    const opener = document.activeElement;
    const node = dialogRef.current;
    if (node) {
      const focusable = node.querySelectorAll(FOCUSABLE_SELECTOR);
      (focusable[0] || node).focus();
    }
    return () => {
      if (opener && document.contains(opener) && typeof opener.focus === 'function') {
        opener.focus();
      }
    };
  }, []);

  // Close on Escape; trap Tab/Shift+Tab within the dialog's focusable elements.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !node.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !node.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`${colors.bgSecondary} rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto ${colors.border} border`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={`flex items-center justify-between p-4 border-b ${colors.border} sticky top-0 ${colors.bgSecondary} z-10`}>
          <h3 id={titleId} className={`text-lg font-semibold ${colors.text}`}>{title}</h3>
          <button
            onClick={onClose}
            className={`${colors.textMuted} hover:${colors.text} transition-colors`}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
