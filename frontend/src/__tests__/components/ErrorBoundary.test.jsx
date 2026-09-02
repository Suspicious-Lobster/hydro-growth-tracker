// MR-23: outside dev, a thrown render used to just vanish — the boundary
// hid the details and gave the user no way to report them. 'Copy details'
// must work in production too, and must put the error message plus the app
// version onto the clipboard.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import ErrorBoundary from '../../components/ErrorBoundary';

function Bomb() {
  throw new Error('kaboom: something exploded');
}

function renderBoundary() {
  return render(
    <ThemeProvider>
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

describe('ErrorBoundary - Copy details', () => {
  beforeEach(() => {
    // jsdom lacks matchMedia; stub it before ThemeProvider reads it.
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    // React logs the thrown render error to console.error; that's expected
    // noise for this test, not a failure signal.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.hydro = { version: '9.9.9' };
    navigator.clipboard = { writeText: vi.fn().mockResolvedValue() };
  });

  it('writes the error message and app version to the clipboard when clicked', async () => {
    renderBoundary();
    const button = screen.getByRole('button', { name: /copy details/i });
    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const written = navigator.clipboard.writeText.mock.calls[0][0];
    expect(written).toContain('kaboom: something exploded');
    expect(written).toContain('Version: 9.9.9');
  });

  it('shows "Copied" after a successful copy', async () => {
    renderBoundary();
    const button = screen.getByRole('button', { name: /copy details/i });
    fireEvent.click(button);
    expect(await screen.findByText('Copied')).toBeTruthy();
  });
});
