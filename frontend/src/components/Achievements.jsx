import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Modal from './ui/Modal';
import { BADGES } from '../utils/achievements';

// MR-45: a grid of every badge, earned ones lit up, opened from Bud's ask menu.
// Pure presentational component over the earnedIds array computed elsewhere.
export default function Achievements({ earnedIds = [], onClose }) {
  const { colors } = useTheme();
  const earnedSet = new Set(earnedIds);
  const earnedCount = BADGES.filter((b) => earnedSet.has(b.id)).length;

  return (
    <Modal title="Your badges" onClose={onClose} maxWidth="max-w-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {BADGES.map((b) => {
          const earned = earnedSet.has(b.id);
          return (
            <div
              key={b.id}
              aria-label={earned ? 'earned' : 'locked'}
              className={`p-3 rounded-lg ${colors.bgPrimary} ${colors.border} border flex items-start gap-2 ${earned ? 'opacity-100' : 'opacity-40'}`}
            >
              <span className="text-2xl leading-none">{b.emoji}</span>
              <div>
                <p className={`font-semibold ${colors.text}`}>{b.label}</p>
                <p className={`text-xs ${colors.textMuted}`}>{b.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className={`text-xs ${colors.textMuted}`}>
        {earnedCount} of {BADGES.length} earned
      </p>
    </Modal>
  );
}
