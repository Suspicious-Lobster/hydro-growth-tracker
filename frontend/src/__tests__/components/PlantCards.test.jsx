// MR-34: species without an authored PLANT_PROFILES entry must not silently
// imply species-specific guidance on the dashboard card. This test renders
// the real Dashboard against a mocked AppDataContext with two plants — one
// whose species has a profile (basil) and one with no species at all
// (falls back to the generic profile) — and asserts the 'generic guidance'
// hint appears only for the one lacking its own profile.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
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
  return render(
    <ThemeProvider>
      <Dashboard onSelectPlant={() => {}} />
    </ThemeProvider>
  );
}

describe('PlantCards Dashboard - generic guidance hint', () => {
  beforeEach(() => {
    window.matchMedia = window.matchMedia || function () {
      return { matches: false, addEventListener() {}, removeEventListener() {} };
    };
    // jsdom lacks matchMedia; stub it before ThemeProvider reads it.
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it('shows generic guidance for a species with no authored profile', () => {
    renderDashboard();
    const mysteryCard = screen.getByText('Mystery Plant').closest('button');
    expect(mysteryCard.textContent).toContain('generic guidance');
  });

  it('does not show generic guidance for a species with its own profile', () => {
    renderDashboard();
    const basilCard = screen.getByText('Basil Plant').closest('button');
    expect(basilCard.textContent).not.toContain('generic guidance');
  });
});
