// MR-50: overlay several plants' growth on one chart, aligned by days since
// each plant's own first log (not by calendar date — plants started at
// different times are still comparable this way). `compareSeries` is the
// pure alignment/merge step; the component just wires it to checkboxes, a
// metric picker and a recharts LineChart.
import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { sortLogsByDate } from '../utils/stats';
import { dayKey } from '../utils/dates';
import { fromCm } from '../utils/format';

// eslint-disable-next-line react-refresh/only-export-components
export const METRICS = [
  { key: 'height', label: 'Height' },
  { key: 'ph', label: 'pH' },
  { key: 'ec', label: 'EC' },
];

const MAX_PLANTS = 6;

// Palette cycled across selected plants' lines (independent of the chem
// colours used in GrowthChart, since these lines all share one metric axis).
const PALETTE = ['#34D399', '#60A5FA', '#F59E0B', '#A78BFA', '#F87171', '#38BDF8'];

const round2 = (n) => Math.round(n * 100) / 100;

// Pure: align each plant's logs by whole days since ITS OWN first log, and
// merge them into recharts rows [{ day, <plantName>: value, ... }]. Plants
// with no logs contribute nothing (no first log to align against).
// eslint-disable-next-line react-refresh/only-export-components
export function compareSeries(plants, getPlantLogs, metric, { lengthUnit = 'cm' } = {}) {
  const rowsByDay = new Map();

  for (const plant of plants || []) {
    const sorted = sortLogsByDate(getPlantLogs(plant));
    if (sorted.length === 0) continue;

    const startDay = dayKey(sorted[0]);
    for (const log of sorted) {
      const day = dayKey(log) - startDay;
      if (Number.isNaN(day)) continue;

      let value;
      if (metric === 'height') {
        const h = parseFloat(log.height);
        value = Number.isNaN(h) ? null : round2(fromCm(h, lengthUnit));
      } else {
        const raw = log[metric];
        const n = raw === null || raw === undefined || raw === '' ? NaN : parseFloat(raw);
        value = Number.isNaN(n) ? null : n;
      }

      const row = rowsByDay.get(day) || { day };
      row[plant.name] = value;
      rowsByDay.set(day, row);
    }
  }

  return Array.from(rowsByDay.values()).sort((a, b) => a.day - b.day);
}

// Collapsible 'Compare plants' card: checkboxes (max 6) pick which plants
// overlay on one LineChart, aligned by days-since-each-plant's-first-log.
function CompareChart({ plants, getPlantLogs, lengthUnit = 'cm' }) {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState([]);
  const [metric, setMetric] = useState('height');

  if (!plants || plants.length < 2) return null;

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_PLANTS) return prev;
      return [...prev, id];
    });
  };

  const selectedPlants = plants.filter((p) => selected.includes(p.id));
  const selectedNames = selectedPlants.map((p) => p.name);
  const metricInfo = METRICS.find((m) => m.key === metric) || METRICS[0];
  const data = compareSeries(selectedPlants, getPlantLogs, metric, { lengthUnit });
  const caption = `Comparing ${metricInfo.label}: ${selectedNames.join(', ')}`;

  const axis = isDark ? '#94a3b8' : '#64748b';
  const grid = isDark ? '#374151' : '#e2e8f0';

  return (
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg ${colors.border} border mt-5`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className={`w-full flex items-center justify-between p-4 text-left ${colors.text} font-semibold`}
      >
        Compare plants
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-3 mb-3">
            {plants.map((plant) => {
              const isSelected = selected.includes(plant.id);
              const disableUnchecked = !isSelected && selected.length >= MAX_PLANTS;
              return (
                <label key={plant.id} className={`flex items-center gap-1.5 text-sm ${colors.textSecondary}`}>
                  <input
                    type="checkbox"
                    aria-label={plant.name}
                    checked={isSelected}
                    disabled={disableUnchecked}
                    onChange={() => toggle(plant.id)}
                  />
                  <span>{plant.name}</span>
                </label>
              );
            })}
          </div>

          <label className={`text-sm ${colors.textSecondary} flex items-center gap-2 mb-3`}>
            Metric
            <select
              aria-label="Compare metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className={`${colors.bgAccent} ${colors.text} rounded px-2 py-1`}
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </label>

          <div role="figure" aria-label={caption}>
            <p className="sr-only">{caption}</p>
            <div style={{ height: 288 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="day" stroke={axis} fontSize={12} />
                  <YAxis stroke={axis} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                      border: `1px solid ${grid}`,
                      borderRadius: 8,
                      color: isDark ? '#f8fafc' : '#1e293b',
                    }}
                  />
                  <Legend />
                  {selectedPlants.map((plant, i) => (
                    <Line
                      key={plant.id}
                      type="monotone"
                      dataKey={plant.name}
                      stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2}
                      name={plant.name}
                      connectNulls
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompareChart;
