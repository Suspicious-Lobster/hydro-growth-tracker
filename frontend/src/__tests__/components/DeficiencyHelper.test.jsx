// MR-40: DeficiencyHelper lets you tick symptoms and shows ranked results.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils';
import DeficiencyHelper from '../../components/DeficiencyHelper';

const renderHelper = (onClose = () => {}) => renderWithProviders(
  <DeficiencyHelper onClose={onClose} />,
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
