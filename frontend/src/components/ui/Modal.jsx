import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Reusable modal dialog. Replaces the hand-rolled fixed-overlay markup that was
// duplicated across PlantManager, FeedingSchedule and the calculator.
const Modal = ({ title, onClose, children, maxWidth = 'max-w-2xl' }) => {
  const { colors } = useTheme();

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
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
        className={`${colors.bgSecondary} rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto ${colors.border} border`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={`flex items-center justify-between p-4 border-b ${colors.border} sticky top-0 ${colors.bgSecondary} z-10`}>
          <h3 className={`text-lg font-semibold ${colors.text}`}>{title}</h3>
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
