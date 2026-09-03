// Pure trend detection over a plant's logs — the analytical half of Bud's
// "smarter brain". Each function returns either null (nothing notable) or a small
// structured result; the copy/tone lives in assistantTips.js. No DOM, no Date.now()
// beyond reading log timestamps, so these stay deterministic and unit-testable.

import { sortLogsByDate, growthRate } from './stats';
import { logTime as logDay, dayKey } from './dates';
import { GROWTH_STAGES } from '../data/plantKnowledge';
import { getProfile } from '../data/recommendations';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

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

// EC moving consistently one way across the last 3 readings (by a meaningful amount).
// Mirrors phTrend, but EC bands are narrower than pH bands, so both the noise
// threshold and the "leaving" margin are tighter here (0.2 / 0.1 vs pH's 0.3 / 0.2).
export function ecTrend(logs, ecRange) {
  const sorted = sortLogsByDate(logs);
  const ec = sorted.map((l) => num(l.ec)).filter((v) => v !== null);
  if (ec.length < 3) return null;
  const [a, b, c] = ec.slice(-3);
  const rising = c > b && b > a;
  const falling = c < b && b < a;
  if (!rising && !falling) return null;
  if (Math.abs(c - a) < 0.2) return null; // ignore measurement noise

  const dir = rising ? 'rising' : 'falling';
  let leaving = false;
  if (ecRange && ecRange.min !== undefined && ecRange.max !== undefined) {
    leaving = (rising && c > ecRange.max - 0.1) || (falling && c < ecRange.min + 0.1);
  }
  return { dir, value: Math.round(c * 10) / 10, min: ecRange?.min, max: ecRange?.max, leaving };
}

// Drift alerts: catches a reading that's already crept out of its band, whether
// via a monotonic trend that's now "leaving" (see phTrend/ecTrend) or via two
// consecutive readings both sitting outside the band with no clean trend to
// report. Returns at most one entry per key ('ph' | 'ec'):
// { key, dir, value, min, max } where dir is 'rising' | 'falling' (trend case)
// or 'high' | 'low' (two-consecutive-out-of-band case).
export function driftAlerts(logs, { phRange, ecRange } = {}) {
  const sorted = sortLogsByDate(logs);
  const alerts = [];

  const outOfBand = (v, range) => v < range.min || v > range.max;

  const check = (key, field, range, trend) => {
    if (!range || range.min === undefined || range.max === undefined) return;
    const vals = sorted.map((l) => num(l[field])).filter((v) => v !== null);
    if (vals.length >= 2) {
      const [prev, last] = vals.slice(-2);
      if (outOfBand(prev, range) && outOfBand(last, range)) {
        const dir = last > range.max ? 'high' : 'low';
        alerts.push({ key, dir, value: Math.round(last * 10) / 10, min: range.min, max: range.max });
        return; // at most one entry per key
      }
    }
    if (trend && trend.leaving) {
      alerts.push({ key, dir: trend.dir, value: trend.value, min: range.min, max: range.max });
    }
  };

  check('ph', 'ph', phRange, phTrend(logs, phRange));
  check('ec', 'ec', ecRange, ecTrend(logs, ecRange));

  return alerts;
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

// "14-21 days" -> {min: 14, max: 21}. A single leading number -> min === max.
// null when unparseable.
const parseDaysRange = (str) => {
  const range = /(\d+)\s*-\s*(\d+)/.exec(str || '');
  if (range) return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) };
  const single = /(\d+)/.exec(str || '');
  return single ? { min: parseInt(single[1], 10), max: parseInt(single[1], 10) } : null;
};

// Lifecycle order of every growth stage, used to walk a plant's logs and find
// where it moved from one stage to a later one.
const STAGE_ORDER = Object.values(GROWTH_STAGES);
const stageIndex = (stage) => STAGE_ORDER.indexOf(stage);

// Walk logs (already sorted by date) and find every point where the explicit
// growth_stage advances from one stage to a strictly later one. Returns
// [{ from, to, days }] in chronological order, where `days` is the observed
// duration of `from` (time between the first log at `from` and the first log
// at `to`).
const stageTransitions = (sorted) => {
  const firstPerStage = [];
  let lastStage = null;
  for (const l of sorted) {
    const s = l.growth_stage;
    if (!s || stageIndex(s) === -1 || s === lastStage) continue;
    firstPerStage.push({ stage: s, time: logDay(l) });
    lastStage = s;
  }
  const transitions = [];
  for (let i = 0; i < firstPerStage.length - 1; i += 1) {
    const a = firstPerStage[i];
    const b = firstPerStage[i + 1];
    if (stageIndex(b.stage) > stageIndex(a.stage)) {
      transitions.push({ from: a.stage, to: b.stage, days: (b.time - a.time) / 86400000 });
    }
  }
  return transitions;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Estimated days until harvest, with a confidence range, or null when the
// plant isn't in the home stretch. Anchored on the first log recorded in late
// flowering plus the species' typical late-flower duration (low/high from the
// profile's min/max, default 21/21 when unknown). The estimate is scaled by
// a pacing factor: how the plant's most recently completed stage (the one
// immediately before late flowering) actually took relative to that stage's
// profile midpoint duration, clamped 0.5-2 — 1 when that transition isn't in
// the logs. `now` is injected for purity.
// Returns { ready, days, low, high, confidence }: ready flips once a
// harvest-stage log exists or the estimate reaches zero; confidence is
// 'high' with 2+ observed completed stage transitions (ending at or before
// late flowering), 'medium' with 1, 'low' with none.
export function harvestCountdown(logs, species, now) {
  const sorted = sortLogsByDate(logs);
  const ready = sorted.some((l) => l.growth_stage === GROWTH_STAGES.HARVEST);
  if (ready) return { ready: true, days: 0, low: 0, high: 0, confidence: 'high' };

  const start = sorted.find((l) => l.growth_stage === GROWTH_STAGES.LATE_FLOWER);
  if (!start) return null;

  const profile = getProfile(species);
  const transitions = stageTransitions(sorted);
  const completed = transitions.filter((t) => stageIndex(t.to) <= stageIndex(GROWTH_STAGES.LATE_FLOWER));
  const confidence = completed.length >= 2 ? 'high' : completed.length === 1 ? 'medium' : 'low';

  let pacing = 1;
  const intoLateFlower = transitions.find((t) => t.to === GROWTH_STAGES.LATE_FLOWER);
  if (intoLateFlower) {
    const midDur = parseDaysRange(profile?.stages?.[intoLateFlower.from]?.duration);
    if (midDur) {
      const midpoint = (midDur.min + midDur.max) / 2;
      pacing = clamp(intoLateFlower.days / midpoint, 0.5, 2);
    }
  }

  const range = parseDaysRange(profile?.stages?.[GROWTH_STAGES.LATE_FLOWER]?.duration) ?? { min: 21, max: 21 };
  const midpoint = (range.min + range.max) / 2;
  const startMs = logDay(start);
  const daysUntil = (durationDays) => Math.max(0, Math.ceil((startMs + pacing * durationDays * 86400000 - now) / 86400000));

  const days = daysUntil(midpoint);
  const low = daysUntil(range.min);
  const high = daysUntil(range.max);
  return { ready: days === 0, days, low, high, confidence };
}

// Consecutive LOCAL calendar days with at least one log, counting back from
// today — or yesterday, so the streak isn't "broken" before the user logs today.
export function careStreak(logs, now) {
  const days = new Set(
    (logs || [])
      .map((l) => dayKey(l))
      .filter((d) => Number.isFinite(d)),
  );
  const today = dayKey(now);
  const anchor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (anchor === null) return 0;
  let n = 0;
  while (days.has(anchor - n)) n += 1;
  return n;
}
