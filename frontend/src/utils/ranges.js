// Classify a logged measurement against a species/stage target range so the
// dashboard can surface out-of-range alerts.

import { getProfile, getStageGuidance } from '../data/recommendations';
import { formatTemp } from './format';

// 'ok' inside range, 'warn' just outside (within 10% of the span), 'out'
// well outside, 'unknown' when there's no value or no target.
export function classify(value, range) {
  if (value === null || value === undefined || value === '') return 'unknown';
  if (!range || range.min === undefined || range.max === undefined) return 'unknown';
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 'unknown';
  if (n >= range.min && n <= range.max) return 'ok';
  const margin = Math.max((range.max - range.min) * 0.1, 0.1);
  if (n >= range.min - margin && n <= range.max + margin) return 'warn';
  return 'out';
}

// Build alert entries for a single log against its plant's species + stage.
// Returns [{ key, label, value, range, status }] for measured values whose
// status is 'warn' or 'out' (i.e. things worth flagging).
export function measurementAlerts(log, species, stage) {
  if (!log) return [];
  const profile = getProfile(species);
  const guidance = getStageGuidance(species, stage);

  const checks = [
    { key: 'ph', label: 'pH', value: log.ph, range: profile.phRange },
    { key: 'ec', label: 'EC', value: log.ec, range: guidance?.ec },
    { key: 'air_temp', label: 'Air temp', value: log.air_temp, range: profile.optimalTemp },
    { key: 'humidity', label: 'Humidity', value: log.humidity, range: profile.optimalHumidity },
  ];

  const alerts = [];
  for (const c of checks) {
    const status = classify(c.value, c.range);
    if (status === 'warn' || status === 'out') {
      alerts.push({ ...c, status });
    }
  }
  return alerts;
}

// Format an alert's value and target range for display in the active units.
// Temperatures are stored canonically in °C, so they must be converted; the
// other tracked measurements (pH, EC, humidity) are unitless.
export function describeAlert(alert, units = {}) {
  if (alert.key === 'air_temp' || alert.key === 'water_temp') {
    const u = units.temp || 'C';
    return {
      value: formatTemp(alert.value, u),
      range: `${formatTemp(alert.range.min, u)}–${formatTemp(alert.range.max, u)}`,
    };
  }
  const suffix = alert.key === 'humidity' ? '%' : '';
  return {
    value: `${alert.value}${suffix}`,
    range: `${alert.range.min}${suffix}–${alert.range.max}${suffix}`,
  };
}

// Tailwind text-color class for a status (used for chips/badges).
export const statusColor = (status) => {
  switch (status) {
    case 'ok': return 'text-green-500';
    case 'warn': return 'text-yellow-500';
    case 'out': return 'text-red-500';
    default: return 'text-gray-400';
  }
};
