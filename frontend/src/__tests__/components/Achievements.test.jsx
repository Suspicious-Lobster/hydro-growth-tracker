// MR-45: Achievements shows a grid of all badges, earned ones lit.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import Achievements from '../../components/Achievements';
import { BADGES } from '../../utils/achievements';

const renderBadges = (earnedIds = [], onClose = () => {}) => renderWithProviders(
  <Achievements earnedIds={earnedIds} onClose={onClose} />,
);

describe('Achievements', () => {
  it('renders every badge label', () => {
    renderBadges();
    for (const b of BADGES) {
      expect(screen.getByText(b.label)).toBeInTheDocument();
    }
  });

  it('marks earned badges with aria-label "earned" and others "locked"', () => {
    renderBadges(['first_plant', 'first_log']);
    expect(screen.getAllByLabelText('earned')).toHaveLength(2);
    expect(screen.getAllByLabelText('locked')).toHaveLength(BADGES.length - 2);
  });

  it('shows the earned-of-total footer line', () => {
    renderBadges(['first_plant']);
    expect(screen.getByText(`1 of ${BADGES.length} earned`)).toBeInTheDocument();
  });

  it('has the modal title "Your badges"', () => {
    renderBadges();
    expect(screen.getByText('Your badges')).toBeInTheDocument();
  });
});
