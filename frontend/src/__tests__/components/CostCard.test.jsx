// MR-53: the cost card renders water used, per-product usage and cost from
// the plant's logs, reservoir events and the settings' price list.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import CostCard from '../../components/CostCard';
import PlantDetail from '../../components/PlantDetail';

const plant = { id: 1, name: 'Tomato', reservoir_volume: 12 };
const logs = [
  { id: 1, plant_id: 1, date: '2026-06-02', height: 10, doses: [{ name: 'Part A', ml_per_l: 2 }, { name: 'Bloom', ml_per_l: 1 }] },
];
const events = [
  { id: 1, plant_id: 1, kind: 'change', date: '2026-06-01', volume: 20 },
  { id: 2, plant_id: 1, kind: 'topoff', date: '2026-06-05', volume: 5 },
];
let settings;

vi.mock('../../contexts/AppDataContext', () => ({
  useAppData: () => ({
    settings,
    schedules: [],
    getPlantLogs: () => logs,
    getPlantReservoirEvents: () => events,
  }),
}));

describe('CostCard (MR-53)', () => {
  beforeEach(() => {
    settings = {
      units: { length: 'cm', volume: 'liters', temp: 'C' },
      nutrient_prices: [{ name: 'Part A', price_per_liter: 30 }],
    };
  });

  it('shows water used, the priced product line, the total and the unpriced note', () => {
    renderWithProviders(<CostCard plant={plant} />);
    const card = screen.getByTestId('cost-card');
    expect(card.textContent).toContain('Water used');
    expect(card.textContent).toContain('25'); // 20 L change + 5 L top-off
    expect(card.textContent).toContain('Part A');
    expect(card.textContent).toContain('40 ml'); // 2 ml/L x 20 L (the change, not the 12 L setting)
    expect(card.textContent).toContain('1.20');
    expect(card.textContent).toContain('Unpriced: Bloom');
  });

  // MR-59: the card is actually mounted in the plant view (a component that
  // exists but nothing renders is not a feature, CODING-PRACTICES 5.0).
  it('PlantDetail renders the cost card', () => {
    renderWithProviders(<PlantDetail plant={plant} onBack={() => {}} />);
    expect(screen.getByTestId('cost-card').textContent).toContain('Water used');
  });

  it('with no doses it explains what to log instead of showing a table', () => {
    logs.length = 0;
    renderWithProviders(<CostCard plant={plant} />);
    expect(screen.getByTestId('cost-card').textContent).toContain('Log doses on your entries');
    logs.push({ id: 1, plant_id: 1, date: '2026-06-02', height: 10, doses: [{ name: 'Part A', ml_per_l: 2 }, { name: 'Bloom', ml_per_l: 1 }] });
  });
});
