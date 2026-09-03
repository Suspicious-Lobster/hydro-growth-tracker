import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Modal from './ui/Modal';
import { SYMPTOMS, diagnose } from '../data/deficiencies';

// Pick what you see, get a ranked best guess at the likely nutrient/root issue
// plus a fix. Pure UI over the pure diagnose() engine in data/deficiencies.js.
export default function DeficiencyHelper({ onClose }) {
  const { colors } = useTheme();
  const [checked, setChecked] = useState([]);

  const toggle = (id) => {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const results = diagnose(checked).slice(0, 3);

  return (
    <Modal title="Let's play plant doctor 🩺" onClose={onClose} maxWidth="max-w-xl">
      <p className={`text-sm ${colors.textMuted} mb-3`}>
        Tick whatever you're seeing and I'll take a guess at what's going on.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">
        {SYMPTOMS.map((s) => (
          <label
            key={s.id}
            className={`flex items-center gap-2 text-sm ${colors.text} cursor-pointer`}
          >
            <input
              type="checkbox"
              checked={checked.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            {s.label}
          </label>
        ))}
      </div>

      {results.length > 0 && (
        <div className="space-y-3 mb-3">
          {results.map((r) => (
            <div key={r.id} className={`p-3 rounded-lg ${colors.bgPrimary} ${colors.border} border`}>
              <p className={`font-semibold ${colors.text}`}>{r.label}</p>
              {r.why && <p className={`text-xs ${colors.textMuted}`}>Matches: {r.why}</p>}
              <p className={`text-sm ${colors.text} mt-1`}>{r.fix}</p>
            </div>
          ))}
        </div>
      )}

      <p className={`text-xs ${colors.textMuted}`}>
        A best guess from what you ticked, not a lab test.
      </p>
    </Modal>
  );
}
