// Display formatting helpers, including unit-aware conversions driven by the
// app settings. Data is always stored canonically (length in cm, temp in °C,
// volume in liters); these functions convert for display only.

export function formatDate(dateString, options = {}) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...options });
}

export function formatDateTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* ----------------------------- unit helpers ----------------------------- */

const round = (n, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// Length is stored in cm. unit ∈ 'cm' | 'in'.
export function formatLength(valueCm, unit = 'cm') {
  if (valueCm === null || valueCm === undefined || valueCm === '') return '—';
  const n = parseFloat(valueCm);
  if (Number.isNaN(n)) return '—';
  if (unit === 'in') return `${round(n / 2.54)} in`;
  return `${round(n)} cm`;
}

// Temperature is stored in °C. unit ∈ 'C' | 'F'.
export function formatTemp(valueC, unit = 'C') {
  if (valueC === null || valueC === undefined || valueC === '') return '—';
  const n = parseFloat(valueC);
  if (Number.isNaN(n)) return '—';
  if (unit === 'F') return `${round(n * 9 / 5 + 32)}°F`;
  return `${round(n)}°C`;
}

// Volume is stored in liters. unit ∈ 'liters' | 'gallons'.
export function formatVolume(valueL, unit = 'liters') {
  if (valueL === null || valueL === undefined || valueL === '') return '—';
  const n = parseFloat(valueL);
  if (Number.isNaN(n)) return '—';
  if (unit === 'gallons') return `${round(n * 0.264172)} gal`;
  return `${round(n)} L`;
}

export const lengthUnitLabel = (unit = 'cm') => (unit === 'in' ? 'in' : 'cm');
export const tempUnitLabel = (unit = 'C') => (unit === 'F' ? '°F' : '°C');
export const volumeUnitLabel = (unit = 'liters') => (unit === 'gallons' ? 'gal' : 'L');

// Convert a user-entered display value back to the canonical storage unit
// (cm / °C / liters). Used by forms so storage is always canonical.
export const toCm = (v, unit) => (unit === 'in' ? v * 2.54 : v);
export const toCelsius = (v, unit) => (unit === 'F' ? ((v - 32) * 5) / 9 : v);
export const toLiters = (v, unit) => (unit === 'gallons' ? v / 0.264172 : v);

// Convert a canonical value to the display unit (for prefilling inputs).
export const fromCm = (v, unit) => (unit === 'in' ? v / 2.54 : v);
export const fromCelsius = (v, unit) => (unit === 'F' ? (v * 9) / 5 + 32 : v);
export const fromLiters = (v, unit) => (unit === 'gallons' ? v * 0.264172 : v);
