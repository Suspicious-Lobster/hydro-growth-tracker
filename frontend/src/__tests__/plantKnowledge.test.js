// MR-26: invariant tests over the plant knowledge base and feeding programme.
//
// Nothing previously checked plantKnowledge.js / feedingSchedule.js for internal
// consistency. A swapped min/max, a gap between stage height ranges, or a
// mislabeled feeding-schedule week would misclassify every reading silently.
// This file defines a checker (`findViolations`) and proves it against BOTH the
// real tables and deliberately corrupted copies (CODING-PRACTICES 1.1f: a check
// never seen red proves nothing).

import { describe, it, expect } from 'vitest';
import { GROWTH_STAGES, PLANT_PROFILES } from '../data/plantKnowledge';
import { FEEDING_SCHEDULE, stageToWeek } from '../data/feedingSchedule';

// Canonical stage order the whole app is built around.
const STAGE_ORDER = Object.values(GROWTH_STAGES);

/**
 * Checks the invariants MR-26 asks for over a PLANT_PROFILES-shaped object and
 * a FEEDING_SCHEDULE-shaped array. Returns an array of human-readable
 * violation strings (empty = clean). Pure function, no mutation of inputs.
 *
 * Per-species (for every entry in `profiles`):
 *   - phRange, optimalTemp, optimalHumidity present with min < max
 *   - stages appear in GROWTH_STAGES order (authored key order must match the
 *     GROWTH_STAGES-filtered order — no stage out of sequence)
 *   - heightRanges are contiguous (each stage's min == previous stage's max,
 *     checked across the stages the species actually defines, in order) and
 *     non-overlapping (a gap or overlap is the same violation: min != prevMax)
 *   - every stage's ec range has min < max
 *
 * Feeding programme (FEEDING_SCHEDULE + stageToWeek):
 *   week.stage is a free-text DISPLAY label ('Established Seedlings', ...),
 *   rendered as text by NutrientCalculator; it was never meant to be a
 *   GROWTH_STAGES key, so no round trip through it is required. What the code
 *   does rely on: weeks are numbered 1..N without gaps or duplicates, every
 *   week carries a non-empty label and a positive EC that never decreases week
 *   over week (the programme ramps up), and stageToWeek() (a switch keyed on
 *   GROWTH_STAGES values, defaulting to week 6) maps EVERY growth stage to a
 *   week number that actually exists in the table -- otherwise the calculator
 *   preselects a week that is not there.
 */
function findViolations(profiles, schedule) {
  const violations = [];

  for (const [species, profile] of Object.entries(profiles || {})) {
    const ph = profile.phRange;
    if (!ph || !(ph.min < ph.max)) {
      violations.push(`${species}.phRange: min ${ph?.min} >= max ${ph?.max}`);
    }
    const temp = profile.optimalTemp;
    if (!temp || !(temp.min < temp.max)) {
      violations.push(`${species}.optimalTemp: min ${temp?.min} >= max ${temp?.max}`);
    }
    const hum = profile.optimalHumidity;
    if (!hum || !(hum.min < hum.max)) {
      violations.push(`${species}.optimalHumidity: min ${hum?.min} >= max ${hum?.max}`);
    }

    const stageKeys = profile.stages ? Object.keys(profile.stages) : [];
    const inGrowthStageOrder = STAGE_ORDER.filter((s) => stageKeys.includes(s));
    if (JSON.stringify(stageKeys) !== JSON.stringify(inGrowthStageOrder)) {
      violations.push(
        `${species}.stages: authored order ${JSON.stringify(stageKeys)} does not match GROWTH_STAGES order ${JSON.stringify(inGrowthStageOrder)}`
      );
    }

    let prevMax = null;
    for (const stageKey of inGrowthStageOrder) {
      const stageData = profile.stages[stageKey];

      const hr = stageData.heightRange;
      if (hr) {
        if (!(hr.min < hr.max)) {
          violations.push(`${species}.${stageKey}.heightRange: min ${hr.min} >= max ${hr.max}`);
        }
        if (prevMax !== null && hr.min !== prevMax) {
          violations.push(
            `${species}.${stageKey}.heightRange: gap/overlap - min ${hr.min} does not equal previous stage max ${prevMax}`
          );
        }
        prevMax = hr.max;
      }

      const ec = stageData.ec;
      if (ec) {
        if (!(ec.min < ec.max)) {
          violations.push(`${species}.${stageKey}.ec: min ${ec.min} >= max ${ec.max}`);
        }
      }
    }
  }

  const weeks = schedule || [];
  if (weeks.length) {
    const numbers = weeks.map((w) => w.week);
    numbers.forEach((n, i) => {
      if (n !== i + 1) violations.push(`schedule[${i}].week: expected ${i + 1}, got ${n}`);
    });
    let prevEc = 0;
    weeks.forEach((w) => {
      if (typeof w.stage !== 'string' || !w.stage.trim()) {
        violations.push(`week ${w.week}.stage: missing label`);
      }
      if (!(w.ec > 0)) violations.push(`week ${w.week}.ec: ${w.ec} is not positive`);
      if (w.ec < prevEc) violations.push(`week ${w.week}.ec: ${w.ec} drops below week before (${prevEc})`);
      prevEc = w.ec;
    });
    const present = new Set(numbers);
    for (const stage of STAGE_ORDER) {
      const wk = stageToWeek(stage);
      if (!present.has(wk)) violations.push(`stageToWeek(${stage}) -> week ${wk}, which is not in the schedule`);
    }
  }

  return violations;
}

describe('findViolations (real tables)', () => {
  it('reports zero species-invariant violations on the real PLANT_PROFILES table', () => {
    const species = Object.keys(PLANT_PROFILES);
    const violations = findViolations(PLANT_PROFILES, []); // schedule check isolated separately below

    // Count invariants actually evaluated, for the required log line.
    let invariantCount = 0;
    for (const profile of Object.values(PLANT_PROFILES)) {
      invariantCount += 3; // phRange, optimalTemp, optimalHumidity
      invariantCount += 1; // stage order
      const stageKeys = profile.stages ? Object.keys(profile.stages) : [];
      invariantCount += stageKeys.length * 2; // heightRange + ec per stage
    }

    console.log(`${species.length} species x ${invariantCount} invariants checked`);

    // NOTE: PLANT_PROFILES currently defines only 3 of the 10 PLANT_TYPES
    // (tomato, lettuce, generic) — cannabis, basil, pepper, cucumber,
    // strawberry, spinach, kale have no profile and silently fall back to
    // 'generic' via getProfile()/getStageGuidance(). The row brief assumed
    // 10; the real table has 3. Asserting against the real count, not the
    // assumed one, per "report a real gap, don't paper over it".
    expect(species.length).toBe(Object.keys(PLANT_PROFILES).length);
    expect(species.length).toBe(3);
    expect(violations).toEqual([]);
  });
});

describe('findViolations (FEEDING_SCHEDULE real data)', () => {
  it('the real 16-week programme is contiguous, labelled, EC-ascending, and reachable from every stage', () => {
    expect(FEEDING_SCHEDULE).toHaveLength(16);
    expect(findViolations({}, FEEDING_SCHEDULE)).toEqual([]);
  });
});

describe('findViolations (red proof: corrupted copies)', () => {
  it('names the exact violation when tomato.seedling.ec has min/max swapped', () => {
    const corrupted = structuredClone(PLANT_PROFILES);
    corrupted.tomato.stages[GROWTH_STAGES.SEEDLING].ec = { min: 1.2, max: 0.8 };

    const violations = findViolations(corrupted, []);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toBe('tomato.seedling.ec: min 1.2 >= max 0.8');
    expect(violations[0].startsWith('tomato.seedling.ec')).toBe(true);
  });

  it('does NOT flag anything when the real tomato ec range is intact (red proof control)', () => {
    // Same check, unmutated data — proves the assertion above is actually
    // exercising the swap, not a checker that always reports this string.
    const violations = findViolations(PLANT_PROFILES, []).filter((v) => v.startsWith('tomato.seedling.ec'));
    expect(violations).toEqual([]);
  });

  it('names the exact stage when a heightRange gap is introduced', () => {
    const corrupted = structuredClone(PLANT_PROFILES);
    // Real: seedling max 15, early_vegetative min 15 (contiguous). Introduce
    // a gap by bumping early_vegetative's min to 20.
    corrupted.tomato.stages[GROWTH_STAGES.EARLY_VEG].heightRange = { min: 20, max: 30 };

    const violations = findViolations(corrupted, []);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toBe(
      'tomato.early_vegetative.heightRange: gap/overlap - min 20 does not equal previous stage max 15'
    );
  });

  it('names the week when a FEEDING_SCHEDULE label is blanked', () => {
    const corrupted = FEEDING_SCHEDULE.map((w) => ({ ...w }));
    corrupted[2].stage = '   ';
    const violations = findViolations({}, corrupted);
    expect(violations).toEqual(['week 3.stage: missing label']);
  });

  it('names the week when a duplicate week number breaks the 1..N sequence', () => {
    const corrupted = FEEDING_SCHEDULE.map((w) => ({ ...w }));
    corrupted[4].week = 4; // two week-4 rows, no week 5
    const violations = findViolations({}, corrupted);
    expect(violations).toEqual(['schedule[4].week: expected 5, got 4']);
  });

  it('names the week when EC drops below the week before', () => {
    const corrupted = FEEDING_SCHEDULE.map((w) => ({ ...w }));
    corrupted[9].ec = 0.5; // week 10, after week 9 at 1.3
    const violations = findViolations({}, corrupted);
    expect(violations).toEqual(['week 10.ec: 0.5 drops below week before (1.3)']);
  });

  it('names the stage whose stageToWeek target week is missing from a truncated programme', () => {
    const truncated = FEEDING_SCHEDULE.slice(0, 10).map((w) => ({ ...w })); // weeks 1..10
    const violations = findViolations({}, truncated);
    // mid_flowering -> 11, late_flowering and harvest_ready -> 15: three stages unreachable.
    expect(violations).toEqual([
      'stageToWeek(mid_flowering) -> week 11, which is not in the schedule',
      'stageToWeek(late_flowering) -> week 15, which is not in the schedule',
      'stageToWeek(harvest_ready) -> week 15, which is not in the schedule',
    ]);
  });
});
