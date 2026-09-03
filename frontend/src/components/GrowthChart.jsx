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

const PH_COLOR = '#F59E0B';    // amber  — pH strip
const EC_COLOR = '#60A5FA';    // blue   — nutrient strength
const HEIGHT_COLOR = '#34D399'; // green — growth
const VPD_COLOR = '#A78BFA';   // purple — vapour-pressure deficit
const IDEAL_COLOR = '#9CA3AF'; // grey   — expected-height reference curve

// Line chart of height over time. When readings carry pH, EC and/or VPD,
// they're drawn on a shared right axis, each with its ideal target range
// shaded behind the line (from the plant's stage guidance) so out-of-range
// readings stand out. When points carry an `ideal` value (the species'
// expected-height curve, MR-48), it's drawn as a dashed grey line on the
// left (height) axis alongside the real growth line.
// `data` items: { date, height, ph?, ec?, vpd?, ideal? }. `phRange`/`ecRange`/`vpdRange`: { min, max }. `species` names the ideal-curve caption.
function GrowthChart({ data, lengthUnit = 'cm', phRange = null, ecRange = null, vpdRange = null, species = null }) {
  const { isDark } = useTheme();
  const axis = isDark ? '#94a3b8' : '#64748b';
  const grid = isDark ? '#374151' : '#e2e8f0';

  const hasPh = Array.isArray(data) && data.some((d) => d.ph !== null && d.ph !== undefined);
  const hasEc = Array.isArray(data) && data.some((d) => d.ec !== null && d.ec !== undefined);
  const hasVpd = Array.isArray(data) && data.some((d) => d.vpd !== null && d.vpd !== undefined);
  const hasChem = hasPh || hasEc || hasVpd;
  const hasIdeal = Array.isArray(data) && data.some((d) => d.ideal !== null && d.ideal !== undefined);

  // Right-axis domain adapts to whatever chemistry is present (so an EC-only
  // chart isn't squashed to the bottom of a pH-sized 0–8 scale).
  const chemValues = [];
  if (Array.isArray(data)) {
    for (const d of data) {
      if (d.ph !== null && d.ph !== undefined) chemValues.push(d.ph);
      if (d.ec !== null && d.ec !== undefined) chemValues.push(d.ec);
      if (d.vpd !== null && d.vpd !== undefined) chemValues.push(d.vpd);
    }
  }
  if (hasPh && phRange) chemValues.push(phRange.max);
  if (hasEc && ecRange) chemValues.push(ecRange.max);
  if (hasVpd && vpdRange) chemValues.push(vpdRange.max);
  const rightMax = chemValues.length ? Math.max(1, Math.ceil(Math.max(...chemValues) + 0.5)) : 1;

  // Ideal-band fills need a touch more opacity on a dark ground to stay visible.
  const phBandOpacity = isDark ? 0.18 : 0.12;
  const ecBandOpacity = isDark ? 0.16 : 0.1;
  const vpdBandOpacity = isDark ? 0.16 : 0.1;

  // Single source of truth for the right-axis chemistry lines: this array
  // drives BOTH the <Line> elements below AND the caption text, so removing
  // a series here (e.g. dropping the vpd entry) removes it from the plotted
  // chart and the caption together rather than requiring two edits to stay
  // in sync (recharts' own <Legend/> text doesn't render in jsdom, since
  // ResponsiveContainer measures 0x0 there, so this caption is the only
  // reliably-testable record of what's actually plotted).
  const chemLines = [];
  if (hasPh) chemLines.push({ key: 'ph', dataKey: 'ph', color: PH_COLOR, name: 'pH' });
  if (hasEc) chemLines.push({ key: 'ec', dataKey: 'ec', color: EC_COLOR, name: 'EC' });
  if (hasVpd) chemLines.push({ key: 'vpd', dataKey: 'vpd', color: VPD_COLOR, name: 'VPD' });

  // Same single-source idea as chemLines above, for the left-axis "Ideal"
  // reference line: this array is what both the <Line> render below AND the
  // caption read, so dropping the ideal entry here (rather than only editing
  // the JSX render below) is what removing the ideal line means in practice.
  const idealLines = [];
  if (hasIdeal) idealLines.push({ key: 'ideal', dataKey: 'ideal', color: IDEAL_COLOR, name: 'Ideal' });

  const caption = ['Growth', ...idealLines.map((l) => l.name), ...chemLines.map((l) => l.name)].join(', ');

  const bandOpacityFor = { ph: phBandOpacity, ec: ecBandOpacity, vpd: vpdBandOpacity };
  const rangeFor = { ph: phRange, ec: ecRange, vpd: vpdRange };

  return (
    <div role="figure" aria-label={caption} className="h-full flex flex-col">
      {/* Visible-but-tiny caption naming what's plotted; see `chemLines`
          above for why this (not recharts' Legend) is the source of truth. */}
      <p className="sr-only">{caption}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="date" stroke={axis} fontSize={12} />
            <YAxis yAxisId="left" stroke={axis} fontSize={12} />
            {hasChem && <YAxis yAxisId="right" orientation="right" stroke={axis} fontSize={12} domain={[0, rightMax]} allowDecimals />}

            {/* Ideal target ranges, shaded behind the lines. */}
            {chemLines.map((l) => {
              const range = rangeFor[l.key];
              if (!range) return null;
              return (
                <ReferenceArea
                  key={l.key}
                  yAxisId="right"
                  y1={range.min}
                  y2={range.max}
                  fill={l.color}
                  fillOpacity={bandOpacityFor[l.key]}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              );
            })}

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
            {idealLines.map((l) => (
              <Line
                key={l.key}
                yAxisId="left"
                type="monotone"
                dataKey={l.dataKey}
                stroke={l.color}
                strokeWidth={2}
                strokeDasharray="6 4"
                name={l.name}
                dot={false}
                connectNulls
              />
            ))}
            {chemLines.map((l) => (
              <Line
                key={l.key}
                yAxisId="right"
                type="monotone"
                dataKey={l.dataKey}
                stroke={l.color}
                strokeWidth={2}
                name={l.name}
                connectNulls
                dot={{ r: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {idealLines.length > 0 && (
        <p className="text-xs text-center mt-1" style={{ color: axis }}>
          Ideal curve from the {species} profile
        </p>
      )}
    </div>
  );
}

export default GrowthChart;
