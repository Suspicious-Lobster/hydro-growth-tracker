// Expected-height curve for a species, built purely from PLANT_PROFILES
// (MR-48). Deliberately reads PLANT_PROFILES directly rather than going
// through data/recommendations' getProfile(), which falls back to the
// generic profile for an unrecognized species — here an unknown species
// must yield null, not the generic curve.
//
// Model: walk GROWTH_STAGES in lifecycle order. For each stage the profile
// actually has, the height is heightRange.min at the START of the stage and
// heightRange.max at the END of the stage, where "end" is start + the
// stage's own midpoint duration (parsed from strings like '14-21 days').
// Inside a stage the height is linearly interpolated between those two
// points; once past the last known stage, the last stage's max height is
// held (plants don't keep growing forever once a profile runs out of
// stages to describe).
import { PLANT_PROFILES, GROWTH_STAGES } from '../data/plantKnowledge';
import { dayKey } from './dates';

const STAGE_ORDER = Object.values(GROWTH_STAGES);

// "14-21 days" -> 17.5. A single leading number -> that number. Unparseable
// (e.g. a stage with no numeric duration) falls back to 14 days so a bad
// duration string can't crash the walk; it only affects that stage's width.
function parseMidDays(str) {
  const range = /(\d+)\s*-\s*(\d+)/.exec(str || '');
  if (range) return (parseInt(range[1], 10) + parseInt(range[2], 10)) / 2;
  const single = /(\d+)/.exec(str || '');
  return single ? parseInt(single[1], 10) : 14;
}

const round1 = (n) => Math.round(n * 10) / 10;

// Expected height (cm) at `daysSinceStart` for `species`, or null when the
// species has no profile/stages, or when daysSinceStart is negative.
export function idealHeightAt(species, daysSinceStart) {
  if (daysSinceStart === null || daysSinceStart === undefined || daysSinceStart < 0) return null;
  const profile = PLANT_PROFILES[species];
  if (!profile || !profile.stages) return null;

  // Build (day, height) knots by walking the stages in lifecycle order,
  // skipping any the profile doesn't define.
  const knots = [];
  let day = 0;
  for (const stage of STAGE_ORDER) {
    const info = profile.stages[stage];
    if (!info || !info.heightRange) continue;
    knots.push({ day, height: info.heightRange.min });
    day += parseMidDays(info.duration);
    knots.push({ day, height: info.heightRange.max });
  }
  if (knots.length === 0) return null;

  if (daysSinceStart <= knots[0].day) return round1(knots[0].height);
  for (let i = 0; i < knots.length - 1; i += 1) {
    const a = knots[i];
    const b = knots[i + 1];
    if (daysSinceStart >= a.day && daysSinceStart <= b.day) {
      if (b.day === a.day) return round1(b.height);
      const frac = (daysSinceStart - a.day) / (b.day - a.day);
      return round1(a.height + frac * (b.height - a.height));
    }
  }
  // Past the last knot: hold the final height.
  return round1(knots[knots.length - 1].height);
}

// Maps each entry in `dates` to its ideal height (cm), given the plant
// started on `startDate`. `dates` may be any value dayKey() accepts (date
// strings, timestamps, Dates). Entries are null where the day offset can't
// be computed or is negative, or where the species has no profile.
export function idealSeries(species, startDate, dates) {
  const startDay = dayKey(startDate);
  return (dates || []).map((d) => {
    if (!Number.isFinite(startDay)) return null;
    const day = dayKey(d);
    if (!Number.isFinite(day)) return null;
    return idealHeightAt(species, day - startDay);
  });
}
