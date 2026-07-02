// Pure trend detection over a plant's logs — the analytical half of Bud's
// "smarter brain". Each function returns either null (nothing notable) or a small
// structured result; the copy/tone lives in assistantTips.js. No DOM, no Date.now()
// beyond reading log timestamps, so these stay deterministic and unit-testable.

import { sortLogsByDate, growthRate } from './stats';
import { GROWTH_STAGES } from '../data/plantKnowledge';
import { getProfile } from '../data/recommendations';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

const logDay = (log) => new Date(log?.date ?? log?.created_at).getTime();

// pH moving consistently one way across the last 3 readings (by a meaningful amount).
// `leaving` flags when that drift is pushing pH out of the species' ideal band.
export function phTrend(logs, phRange) {
  const sorted = sortLogsByDate(logs);
  const ph = sorted.map((l) => num(l.ph)).filter((v) => v !== null);
  if (ph.length < 3) return null;
  const [a, b, c] = ph.slice(-3);
  const rising = c > b && b > a;
  const falling = c < b && b < a;
  if (!rising && !falling) return null;
  if (Math.abs(c - a) < 0.3) return null; // ignore measurement noise

  const dir = rising ? 'rising' : 'falling';
  let leaving = false;
  if (phRange && phRange.min !== undefined && phRange.max !== undefined) {
    leaving = (rising && c > phRange.max - 0.2) || (falling && c < phRange.min + 0.2);
  }
  return { dir, value: Math.round(c * 10) / 10, min: phRange?.min, max: phRange?.max, leaving };
}

// Height essentially flat across the last >=3 logs spanning >=5 days.
export function growthStall(logs) {
  const sorted = sortLogsByDate(logs);
  if (sorted.length < 3) return null;
  const last3 = sorted.slice(-3);
  const heights = last3.map((l) => num(l.height));
  if (heights.some((h) => h === null)) return null;
  const spanDays = (logDay(last3[2]) - logDay(last3[0])) / 86400000;
  const gain = heights[2] - heights[0];
  if (spanDays >= 5 && gain <= 0.5) return { days: Math.round(spanDays), gain: Math.round(gain * 10) / 10 };
  return null;
}

// Vigorous average growth worth a little praise.
export function strongGrowth(logs) {
  const sorted = sortLogsByDate(logs);
  if (sorted.length < 2) return null;
  const rate = growthRate(logs);
  if (rate >= 1.5) return { rate };
  return null;
}

// True once the plant is in (or past) late flowering — harvest is near.
export function isHarvestWindow(stage) {
  return stage === GROWTH_STAGES.LATE_FLOWER || stage === GROWTH_STAGES.HARVEST;
}

// "14-21 days" -> 21. Falls back through a single leading number, else null.
const parseMaxDays = (str) => {
  const range = /(\d+)\s*-\s*(\d+)/.exec(str || '');
  if (range) return parseInt(range[2], 10);
  const single = /(\d+)/.exec(str || '');
  return single ? parseInt(single[1], 10) : null;
};

// Estimated days until harvest, or null when the plant isn't in the home stretch.
// Anchored on the first log recorded in late flowering plus the species' typical
// late-flower duration (default 21 days). `now` is injected for purity.
// Returns { ready, days }: ready flips once a harvest-stage log exists or the
// estimate reaches zero.
export function harvestCountdown(logs, species, now) {
  const sorted = sortLogsByDate(logs);
  if (sorted.some((l) => l.growth_stage === GROWTH_STAGES.HARVEST)) return { ready: true, days: 0 };
  const start = sorted.find((l) => l.growth_stage === GROWTH_STAGES.LATE_FLOWER);
  if (!start) return null;
  const profile = getProfile(species);
  const dur = parseMaxDays(profile?.stages?.[GROWTH_STAGES.LATE_FLOWER]?.duration) ?? 21;
  const eta = logDay(start) + dur * 86400000;
  const days = Math.max(0, Math.ceil((eta - now) / 86400000));
  return { ready: days === 0, days };
}

// Consecutive calendar days (UTC buckets) with at least one log, counting back from
// today — or yesterday, so the streak isn't "broken" before the user logs today.
export function careStreak(logs, now) {
  const days = new Set(
    (logs || [])
      .map((l) => Math.floor(logDay(l) / 86400000))
      .filter((d) => Number.isFinite(d)),
  );
  const today = Math.floor(now / 86400000);
  const anchor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (anchor === null) return 0;
  let n = 0;
  while (days.has(anchor - n)) n += 1;
  return n;
}
