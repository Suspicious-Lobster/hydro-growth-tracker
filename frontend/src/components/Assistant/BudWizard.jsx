import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// The first-run tour bubble. Styled like SpeechBubble (themed card + down-right tail)
// but with tour controls: a primary action, an optional secondary, a "step N of M"
// hint, and a persistent "Skip tour" link.
const PRIMARY_LABEL = { next: "Let's go", goto: 'Take me there', finish: 'Finish' };

export default function BudWizard({ step, index, total, animate = true, onPrimary, onSecondary, onSkip }) {
  const { colors } = useTheme();
  if (!step) return null;

  const terminal = step.primary === 'finish';
  const showSecondary = !terminal && step.primary !== 'next';

  return (
    <div
      className={`relative mb-2 w-72 max-w-[80vw] ${colors.bgSecondary} ${colors.border} border rounded-2xl shadow-xl p-3 ${animate ? 'animate-bud-rise' : ''}`}
      role="dialog"
      aria-label="Bud's welcome tour"
    >
      <p className={`text-[11px] font-medium ${colors.textMuted} mb-1`}>
        Welcome tour · {index + 1} of {total}
      </p>
      <p className={`text-sm leading-snug ${colors.text}`}>{step.text}</p>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onPrimary}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-light-primary-bg dark:bg-dark-primary-bg text-white shadow hover:opacity-90 transition-opacity"
        >
          {PRIMARY_LABEL[step.primary] || 'Next'}
        </button>
        {showSecondary && (
          <button
            onClick={onSecondary}
            className={`px-3 py-1.5 rounded-lg text-sm ${colors.text} hover:${colors.bgPrimary} transition-colors`}
          >
            {step.optional ? 'Skip this' : 'Maybe later'}
          </button>
        )}
        {!terminal && (
          <button
            onClick={onSkip}
            className={`ml-auto text-[11px] ${colors.textMuted} underline hover:${colors.text}`}
          >
            Skip tour
          </button>
        )}
      </div>

      {/* tail */}
      <div
        className={`absolute -bottom-2 right-6 w-4 h-4 rotate-45 ${colors.bgSecondary} ${colors.border} border-r border-b`}
      />
    </div>
  );
}
