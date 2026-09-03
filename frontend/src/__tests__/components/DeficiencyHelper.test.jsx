// MR-40: DeficiencyHelper lets you tick symptoms and shows ranked results.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import DeficiencyHelper from '../../components/DeficiencyHelper';

// jsdom lacks matchMedia; stub it before ThemeProvider reads it.
window.matchMedia = vi.fn().mockImplementation(() => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}));

const renderHelper = (onClose = () => {}) => render(
  <ThemeProvider>
    <DeficiencyHelper onClose={onClose} />
  </ThemeProvider>,
);

describe('DeficiencyHelper', () => {
  it('shows no results before anything is ticked', () => {
    renderHelper();
    expect(screen.queryByText(/Phosphorus/)).not.toBeInTheDocument();
  });

  it('ticking "Purple stems" shows Phosphorus in the results', async () => {
    const user = userEvent.setup();
    renderHelper();
    await user.click(screen.getByLabelText('Purple stems'));
    expect(screen.getByText(/Phosphorus/)).toBeInTheDocument();
  });

  it('shows the disclaimer line', () => {
    renderHelper();
    expect(screen.getByText(/not a lab test/)).toBeInTheDocument();
  });
});
