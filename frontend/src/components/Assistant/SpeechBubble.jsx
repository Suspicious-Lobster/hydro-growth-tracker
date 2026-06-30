import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Bud's speech bubble. Sits above the leaf with a little tail pointing down-right
// toward it. Offers a close (this tip) and a "don't show again" action.
export default function SpeechBubble({ tip, animate = true, onClose, onDontShow }) {
  const { colors } = useTheme();
  if (!tip) return null;

  return (
    <div
      className={`relative mb-2 w-64 max-w-[80vw] ${colors.bgSecondary} ${colors.border} border rounded-2xl shadow-xl p-3 ${animate ? 'animate-bud-rise' : ''}`}
      role="status"
    >
      <button
        onClick={onClose}
        aria-label="Dismiss tip"
        className={`absolute top-2 right-2 ${colors.textMuted} hover:${colors.text}`}
      >
        <X size={14} />
      </button>
      <p className={`text-sm leading-snug ${colors.text} pr-4`}>{tip.text}</p>
      {tip.dismissible && (
        <button
          onClick={onDontShow}
          className={`mt-2 text-[11px] ${colors.textMuted} underline hover:${colors.text}`}
        >
          Don't show this again
        </button>
      )}
      {/* tail */}
      <div
        className={`absolute -bottom-2 right-6 w-4 h-4 rotate-45 ${colors.bgSecondary} ${colors.border} border-r border-b`}
      />
    </div>
  );
}
