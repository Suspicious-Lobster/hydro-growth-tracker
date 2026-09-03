// MR-15: the About dialog must show the real packaged version (read through
// preload.js's window.hydro bridge, never hard-coded), and the production
// build must carry a Content-Security-Policy meta tag while the dev source
// HTML must not (Vite HMR needs inline scripts in dev).
import React from 'react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import AboutDialog from '../../components/AboutDialog';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '../../..');

function renderAbout() {
  return renderWithProviders(<AboutDialog onClose={() => {}} />);
}

describe('AboutDialog', () => {
  const originalHydro = window.hydro;

  afterEach(() => {
    window.hydro = originalHydro;
  });

  it('shows the version from window.hydro.version', () => {
    window.hydro = { version: '9.9.9-test' };
    renderAbout();
    expect(screen.getByText(/9\.9\.9-test/)).toBeInTheDocument();
  });

  it('falls back to "development build" when window.hydro is undefined', () => {
    window.hydro = undefined;
    renderAbout();
    expect(screen.getByText(/development build/)).toBeInTheDocument();
  });
});

describe('CSP build output', () => {
  it('the production build (frontend/dist/index.html) contains a CSP meta tag', () => {
    const distPath = path.join(FRONTEND_ROOT, 'dist', 'index.html');
    if (!fs.existsSync(distPath)) {
      throw new Error(
        `${distPath} does not exist. Run "npm run build" in ./frontend before running this test.`
      );
    }
    const html = fs.readFileSync(distPath, 'utf-8');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("connect-src 'self' http://127.0.0.1:*");
  });

  it('the dev source (frontend/index.html) does not contain a CSP meta tag', () => {
    const devIndexPath = path.join(FRONTEND_ROOT, 'index.html');
    const html = fs.readFileSync(devIndexPath, 'utf-8');
    expect(html).not.toContain('Content-Security-Policy');
  });
});
