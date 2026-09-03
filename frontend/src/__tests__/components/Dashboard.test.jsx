// MR-25: Dashboard's out-of-range alert badge was previously unverified
// except by hand. Tomato's phRange is 5.8-6.2 (plantKnowledge.js); a pH of
// 7.5 is well outside it and must surface an alert, while pH 6.0 is within
// range and must not.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import Dashboard from '../../components/PlantCards';

const plants = [
  { id: 1, name: 'High pH Tomato', species: 'tomato' },
  { id: 2, name: 'Fine Tomato', species: 'tomato' },
];

const logsByPlant = {
  1: [{ id: 1, plant_id: 1, date: '2026-06-01', height: 20, ph: 7.5 }],
  2: [{ id: 2, plant_id: 2, date: '2026-06-01', height: 20, ph: 6.0 }],
};

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    plants,
    settings: { units: { length: 'cm', temp: 'C' } },
    getPlantLogs: (plant) => logsByPlant[plant.id] || [],
  }),
}));

function renderDashboard() {
  return renderWithProviders(<Dashboard onSelectPlant={() => {}} />);
}

describe('Dashboard alerts (MR-25)', () => {
  it('shows an out-of-range pH alert for a tomato logged at pH 7.5', () => {
    renderDashboard();
    const card = screen.getByRole('heading', { name: 'High pH Tomato' }).closest('button');
    expect(card.textContent).toContain('pH');
    expect(card.textContent).toContain('out of range');
  });

  it('shows no out-of-range alert for a tomato logged at pH 6.0', () => {
    renderDashboard();
    const card = screen.getByRole('heading', { name: 'Fine Tomato' }).closest('button');
    expect(card.textContent).not.toContain('out of range');
  });
});
