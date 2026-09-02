import React from 'react';
import Modal from './ui/Modal';
import { useTheme } from '../contexts/ThemeContext';

// MR-15: shows the packaged app version (read through preload.js's
// window.hydro bridge, never bundled at build time) plus a one-line privacy
// note and where the data file lives on each OS.
const AboutDialog = ({ onClose }) => {
  const { colors } = useTheme();
  const version = window.hydro?.version || 'development build';

  return (
    <Modal title="About Hydro Growth Tracker" onClose={onClose} maxWidth="max-w-md">
      <div className={`space-y-3 ${colors.text}`}>
        <p className="font-medium">Version {version}</p>
        <p>All data stays on this computer.</p>
        <div className={`text-sm ${colors.textMuted} space-y-1`}>
          <p>Your data file lives at:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Windows: %APPDATA%\Hydro Growth Tracker</li>
            <li>macOS: ~/Library/Application Support/Hydro Growth Tracker</li>
            <li>Linux: ~/.config/Hydro Growth Tracker</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default AboutDialog;
