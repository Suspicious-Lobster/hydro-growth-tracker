// MR-34: species without an authored PLANT_PROFILES entry must not silently
// imply species-specific guidance on the dashboard card. This test renders
// the real Dashboard against a mocked AppDataContext with two plants — one
// whose species has a profile (basil) and one with no species at all
// (falls back to the generic profile) — and asserts the 'generic guidance'
// hint appears only for the one lacking its own profile.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import Dashboard from '../../components/PlantCards';

const plants = [
  { id: 1, name: 'Basil Plant', species: 'basil' },
  { id: 2, name: 'Mystery Plant', species: '' },
];

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    plants,
    settings: { units: { length: 'cm', temp: 'C' } },
    getPlantLogs: () => [],
  }),
}));

function renderDashboard() {
  return renderWithProviders(<Dashboard onSelectPlant={() => {}} />);
}

describe('PlantCards Dashboard - generic guidance hint', () => {
  it('shows generic guidance for a species with no authored profile', () => {
    renderDashboard();
    const mysteryCard = screen.getByRole('heading', { name: 'Mystery Plant' }).closest('button');
    expect(mysteryCard.textContent).toContain('generic guidance');
  });

  it('does not show generic guidance for a species with its own profile', () => {
    renderDashboard();
    const basilCard = screen.getByRole('heading', { name: 'Basil Plant' }).closest('button');
    expect(basilCard.textContent).not.toContain('generic guidance');
  });
});
