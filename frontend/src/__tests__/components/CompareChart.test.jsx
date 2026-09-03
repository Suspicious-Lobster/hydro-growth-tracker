// MR-50: component-level coverage for the 'Compare plants' card. Props are
// passed directly (no AppDataContext mock needed). Fixture: plant A starts
// 2026-03-01, plant B starts 2026-06-01 (different months — see
// compareSeries.test.js for the same precondition asserted at the pure-fn
// level), both with day 0 and day 7 logs.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import CompareChart from '../../components/CompareChart';

const plantA = { id: 1, name: 'Alpha Plant' };
const plantB = { id: 2, name: 'Beta Plant' };

const logsById = {
  1: [
    { id: 1, plant_id: 1, date: '2026-03-01', height: 10, ph: 6.0 },
    { id: 2, plant_id: 1, date: '2026-03-08', height: 15, ph: 6.1 },
  ],
  2: [
    { id: 3, plant_id: 2, date: '2026-06-01', height: 5, ph: 5.9 },
    { id: 4, plant_id: 2, date: '2026-06-08', height: 8, ph: 6.0 },
  ],
};

const getPlantLogs = (plant) => logsById[plant.id] || [];

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  // jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one to
  // mount at all (see vpd.test.js for the same stub).
  globalThis.ResizeObserver = globalThis.ResizeObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function renderChart(plants) {
  return render(
    <ThemeProvider>
      <CompareChart plants={plants} getPlantLogs={getPlantLogs} lengthUnit="cm" />
    </ThemeProvider>
  );
}

describe('CompareChart (MR-50)', () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it('does not render with one plant', () => {
    const { container } = renderChart([plantA]);
    expect(container).toBeEmptyDOMElement();
  });

  it('precondition: plant A and plant B start in different months', () => {
    expect(logsById[1][0].date.slice(0, 7)).not.toBe(logsById[2][0].date.slice(0, 7));
  });

  it('is collapsed by default and expands on click, then ticking two plants shows both names in the figure caption', async () => {
    const user = userEvent.setup();
    renderChart([plantA, plantB]);

    const header = screen.getByRole('button', { name: /compare plants/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('checkbox', { name: 'Alpha Plant' }));
    await user.click(screen.getByRole('checkbox', { name: 'Beta Plant' }));

    const figure = screen.getByRole('figure');
    expect(figure).toHaveAccessibleName(/Comparing Height: Alpha Plant, Beta Plant/);
  });

  it('disables unchecked boxes once 6 plants are ticked', async () => {
    const plants = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, name: `Plant ${i + 1}` }));
    const emptyLogs = () => [];
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <CompareChart plants={plants} getPlantLogs={emptyLogs} lengthUnit="cm" />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: /compare plants/i }));

    for (let i = 1; i <= 6; i += 1) {
      await user.click(screen.getByRole('checkbox', { name: `Plant ${i}` }));
    }

    const seventh = screen.getByRole('checkbox', { name: 'Plant 7' });
    expect(seventh).toBeDisabled();
  });
});
