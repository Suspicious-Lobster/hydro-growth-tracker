import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { useTheme } from '../contexts/ThemeContext';

function GrowthChart({ data }) {
  const { colors } = useTheme();

  // Only plot pH if at least one point actually has a reading.
  const hasPh = Array.isArray(data) && data.some((d) => d.ph !== null && d.ph !== undefined);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className={`w-full h-80 ${colors.bgAccent} rounded-xl shadow-xl p-4 flex items-center justify-center`}>
        <p className={colors.textMuted}>No data to chart yet.</p>
      </div>
    );
  }

  return (
    <div className={`w-full h-80 ${colors.bgAccent} rounded-xl shadow-xl p-4`}>
      <h2 className={`text-xl font-semibold ${colors.primary} mb-4`}>
        📈 Growth Chart
      </h2>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#88888855" />
          <XAxis dataKey="date" stroke="#888" fontSize={12} />
          <YAxis yAxisId="left" stroke="#34D399" fontSize={12} />
          {hasPh && <YAxis yAxisId="right" orientation="right" domain={[0, 14]} stroke="#60A5FA" fontSize={12} />}
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="height" stroke="#34D399" strokeWidth={2} name="Height (cm)" />
          {hasPh && (
            <Line yAxisId="right" type="monotone" dataKey="ph" stroke="#60A5FA" strokeWidth={2} name="pH" connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GrowthChart;
