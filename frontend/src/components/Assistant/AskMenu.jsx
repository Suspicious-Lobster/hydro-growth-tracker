import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// The little menu that pops above Bud when you click him. Mirrors SpeechBubble's
// look (themed card + down-right tail) and offers a few things to ask. Picking one
// calls onPick(key); the parent turns that into an answer in the speech bubble.
// MR-66: a free-text input sits above the fixed items — Enter with non-empty
// text calls onAsk(text) and clears the box, so a typed question and a picked
// item both land in the same speech bubble.
const ITEMS = [
  { key: 'status', label: "How's my plant?" },
  { key: 'week', label: 'How was my week?' },
  { key: 'action', label: 'What should I do?' },
  { key: 'fun', label: 'Tell me something' },
  { key: 'diagnose', label: 'Something looks wrong' },
  { key: 'badges', label: 'Show my badges' },
];

export default function AskMenu({ animate = true, onPick, onAsk = () => {} }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAsk(trimmed);
    setText('');
  };

  return (
    <div
      className={`relative mb-2 w-56 max-w-[80vw] ${colors.bgSecondary} ${colors.border} border rounded-2xl shadow-xl p-2 ${animate ? 'animate-bud-rise' : ''}`}
      role="menu"
      aria-label="Ask Bud"
    >
      <p className={`px-2 pt-1 pb-1.5 text-[11px] font-medium ${colors.textMuted}`}>Whatcha need? 🌿</p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        aria-label="Ask Bud anything"
        placeholder="Ask me anything..."
        className={`mb-1.5 w-full px-2 py-1.5 rounded-lg text-sm border ${colors.border} ${colors.bgPrimary} ${colors.text}`}
      />
      {ITEMS.map((item) => (
        <button
          key={item.key}
          role="menuitem"
          onClick={() => onPick(item.key)}
          className={`block w-full text-left px-2 py-1.5 rounded-lg text-sm ${colors.text} hover:${colors.bgPrimary} transition-colors`}
        >
          {item.label}
        </button>
      ))}
      {/* tail */}
      <div
        className={`absolute -bottom-2 right-6 w-4 h-4 rotate-45 ${colors.bgSecondary} ${colors.border} border-r border-b`}
      />
    </div>
  );
}
