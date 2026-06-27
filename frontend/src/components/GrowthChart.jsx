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
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

// Line chart of height over time, with an optional second axis for EC when any
// data point carries an `ec` reading. `data` items: { date, height, ec? }.
function GrowthChart({ data, lengthUnit = 'cm' }) {
  const { isDark } = useTheme();
  const axis = isDark ? '#94a3b8' : '#64748b';
  const grid = isDark ? '#374151' : '#e2e8f0';
  const hasEc = Array.isArray(data) && data.some((d) => d.ec !== null && d.ec !== undefined);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="date" stroke={axis} fontSize={12} />
        <YAxis yAxisId="left" stroke={axis} fontSize={12} />
        {hasEc && <YAxis yAxisId="right" orientation="right" stroke="#60A5FA" fontSize={12} />}
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
          stroke="#34D399"
          strokeWidth={2}
          name={`Height (${lengthUnit})`}
          dot={{ r: 2 }}
        />
        {hasEc && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ec"
            stroke="#60A5FA"
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
