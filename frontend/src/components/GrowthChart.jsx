import React from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { useTheme } from '../contexts/ThemeContext';

// Theme-aware color palette for the chart. Recharts needs concrete color
// values, so we derive them from the active theme rather than Tailwind classes.
const palette = (isDark) => isDark ? {
  height: '#34D399',
  ph: '#60A5FA',
  grid: 'rgba(148,163,184,0.18)',
  axis: '#94a3b8',
  band: '#34D399',
  bandOpacity: 0.10,
  tooltipBg: '#1a1a1a',
  tooltipBorder: '#374151',
  tooltipText: '#f8fafc',
  tooltipMuted: '#94a3b8',
} : {
  height: '#059669',
  ph: '#2563eb',
  grid: 'rgba(100,116,139,0.18)',
  axis: '#64748b',
  band: '#059669',
  bandOpacity: 0.09,
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
  tooltipText: '#1e293b',
  tooltipMuted: '#64748b',
};

// Drop the year from a localized "M/D/YYYY" tick to keep the axis uncluttered.
const shortDate = (value) => {
  if (typeof value !== 'string') return value;
  const parts = value.split('/');
  return parts.length === 3 ? `${parts[0]}/${parts[1]}` : value;
};

function GrowthChart({ data, large = false }) {
  const { isDark } = useTheme();
  const c = palette(isDark);

  const hasData = Array.isArray(data) && data.length > 0;
  const phValues = hasData
    ? data.map((d) => d.ph).filter((v) => v !== null && v !== undefined)
    : [];
  const hasPh = phValues.length > 0;

  // Keep the 5.5–6.5 ideal band visible and give the pH line breathing room.
  const phMin = hasPh ? Math.min(...phValues) : 5.5;
  const phMax = hasPh ? Math.max(...phValues) : 6.5;
  const phDomain = [
    Math.min(5, Math.floor(phMin * 2) / 2 - 0.5),
    Math.max(7, Math.ceil(phMax * 2) / 2 + 0.5),
  ];

  const chartHeight = large ? 380 : 240;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div
        style={{
          background: c.tooltipBg,
          border: `1px solid ${c.tooltipBorder}`,
          borderRadius: 10,
          padding: '8px 12px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ color: c.tooltipMuted, fontSize: 12, marginBottom: 4 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: c.tooltipText, fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: p.color }}>●</span>{' '}
            {p.name}: {p.value}{p.dataKey === 'height' ? ' cm' : ''}
          </div>
        ))}
      </div>
    );
  };

  if (!hasData) {
    return (
      <div
        className="w-full flex items-center justify-center rounded-xl"
        style={{ height: chartHeight, background: c.grid }}
      >
        <p style={{ color: c.axis }}>No data to chart yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: hasPh ? 16 : 12, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id="heightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.height} stopOpacity={0.35} />
              <stop offset="100%" stopColor={c.height} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            stroke={c.axis}
            tick={{ fill: c.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            minTickGap={20}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            stroke={c.height}
            tick={{ fill: c.axis, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={36}
            domain={[0, 'auto']}
          />
          {hasPh && (
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={phDomain}
              stroke={c.ph}
              tick={{ fill: c.axis, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v) => v.toFixed(1)}
            />
          )}

          {hasPh && (
            <ReferenceArea
              yAxisId="right"
              y1={5.5}
              y2={6.5}
              fill={c.band}
              fillOpacity={c.bandOpacity}
              ifOverflow="extendDomain"
            />
          )}

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: c.axis, paddingTop: 6 }}
          />

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="height"
            name="Height (cm)"
            stroke={c.height}
            strokeWidth={2.5}
            fill="url(#heightFill)"
            dot={{ r: 3, fill: c.height, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          {hasPh && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="ph"
              name="pH"
              stroke={c.ph}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3, fill: c.ph, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default GrowthChart;
