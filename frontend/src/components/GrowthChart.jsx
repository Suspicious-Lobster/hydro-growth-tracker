import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

const PH_COLOR = '#F59E0B';    // amber — pH strip
const EC_COLOR = '#60A5FA';    // blue  — nutrient strength
const HEIGHT_COLOR = '#34D399'; // green — growth

// Line chart of height over time. When readings carry pH and/or EC, they're
// drawn on a shared right axis, each with its ideal target range shaded behind
// the line (from the plant's stage guidance) so out-of-range readings stand out.
// `data` items: { date, height, ph?, ec? }. `phRange`/`ecRange`: { min, max }.
function GrowthChart({ data, lengthUnit = 'cm', phRange = null, ecRange = null }) {
  const { isDark } = useTheme();
  const axis = isDark ? '#94a3b8' : '#64748b';
  const grid = isDark ? '#374151' : '#e2e8f0';

  const hasPh = Array.isArray(data) && data.some((d) => d.ph !== null && d.ph !== undefined);
  const hasEc = Array.isArray(data) && data.some((d) => d.ec !== null && d.ec !== undefined);
  const hasChem = hasPh || hasEc;

  // Right-axis domain adapts to whatever chemistry is present (so an EC-only
  // chart isn't squashed to the bottom of a pH-sized 0–8 scale).
  const chemValues = [];
  if (Array.isArray(data)) {
    for (const d of data) {
      if (d.ph !== null && d.ph !== undefined) chemValues.push(d.ph);
      if (d.ec !== null && d.ec !== undefined) chemValues.push(d.ec);
    }
  }
  if (hasPh && phRange) chemValues.push(phRange.max);
  if (hasEc && ecRange) chemValues.push(ecRange.max);
  const rightMax = chemValues.length ? Math.max(1, Math.ceil(Math.max(...chemValues) + 0.5)) : 1;

  // Ideal-band fills need a touch more opacity on a dark ground to stay visible.
  const phBandOpacity = isDark ? 0.18 : 0.12;
  const ecBandOpacity = isDark ? 0.16 : 0.1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="date" stroke={axis} fontSize={12} />
        <YAxis yAxisId="left" stroke={axis} fontSize={12} />
        {hasChem && <YAxis yAxisId="right" orientation="right" stroke={axis} fontSize={12} domain={[0, rightMax]} allowDecimals />}

        {/* Ideal target ranges, shaded behind the lines. */}
        {hasPh && phRange && (
          <ReferenceArea yAxisId="right" y1={phRange.min} y2={phRange.max} fill={PH_COLOR} fillOpacity={phBandOpacity} stroke="none" ifOverflow="extendDomain" />
        )}
        {hasEc && ecRange && (
          <ReferenceArea yAxisId="right" y1={ecRange.min} y2={ecRange.max} fill={EC_COLOR} fillOpacity={ecBandOpacity} stroke="none" ifOverflow="extendDomain" />
        )}

        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            border: `1px solid ${grid}`,
            borderRadius: 8,
            color: isDark ? '#f8fafc' : '#1e293b',
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="height"
          stroke={HEIGHT_COLOR}
          strokeWidth={2}
          name={`Height (${lengthUnit})`}
          dot={{ r: 2 }}
        />
        {hasPh && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ph"
            stroke={PH_COLOR}
            strokeWidth={2}
            name="pH"
            connectNulls
            dot={{ r: 2 }}
          />
        )}
        {hasEc && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ec"
            stroke={EC_COLOR}
            strokeWidth={2}
            name="EC"
            connectNulls
            dot={{ r: 2 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default GrowthChart;
