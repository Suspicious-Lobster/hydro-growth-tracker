// Species- and stage-aware guidance built on top of plantKnowledge.js.
// Replaces the old one-size-fits-all height thresholds (10/30/60 cm) that the
// feeding view used for every plant regardless of species.

import { PLANT_PROFILES, PLANT_TYPES, GROWTH_STAGES } from './plantKnowledge';

// Human-readable labels for the internal stage keys.
export const STAGE_LABELS = {
  [GROWTH_STAGES.SEEDLING]: 'Seedling',
  [GROWTH_STAGES.EARLY_VEG]: 'Early Vegetative',
  [GROWTH_STAGES.VEGETATIVE]: 'Vegetative',
  [GROWTH_STAGES.PRE_FLOWER]: 'Pre-Flowering',
  [GROWTH_STAGES.EARLY_FLOWER]: 'Early Flowering',
  [GROWTH_STAGES.MID_FLOWER]: 'Mid Flowering',
  [GROWTH_STAGES.LATE_FLOWER]: 'Late Flowering',
  [GROWTH_STAGES.HARVEST]: 'Harvest Ready',
};

export const stageLabel = (stage) => STAGE_LABELS[stage] || 'Unknown';

// Ordered species options for pickers ([{ value, label }]).
export const SPECIES_OPTIONS = Object.values(PLANT_TYPES).map((value) => ({
  value,
  label: PLANT_PROFILES[value]?.name || value,
}));

// Resolve a usable profile, always falling back to the generic profile.
export function getProfile(species) {
  return PLANT_PROFILES[species] || PLANT_PROFILES[PLANT_TYPES.GENERIC];
}

// True only when `species` has its own authored PLANT_PROFILES entry (not the
// generic fallback). Used by the UI to flag species-specific vs generic
// guidance instead of silently implying every species has real targets.
export function hasOwnProfile(species) {
  if (!species) return false;
  return Object.prototype.hasOwnProperty.call(PLANT_PROFILES, species) && species !== PLANT_TYPES.GENERIC;
}

// Stages this species actually defines, in lifecycle order.
const STAGE_ORDER = Object.values(GROWTH_STAGES);
export function getProfileStages(species) {
  const profile = getProfile(species);
  return STAGE_ORDER.filter((s) => profile.stages && profile.stages[s]);
}

// Determine the growth stage for a log: explicit value wins; otherwise infer
// from height using the species' per-stage heightRange; otherwise null.
export function inferStage(species, heightCm, explicitStage) {
  if (explicitStage) return explicitStage;
  if (heightCm === null || heightCm === undefined || heightCm === '') return null;
  const h = parseFloat(heightCm);
  if (Number.isNaN(h)) return null;

  const profile = getProfile(species);
  const stages = getProfileStages(species);
  for (const stage of stages) {
    const range = profile.stages[stage].heightRange;
    if (range && h >= range.min && h <= range.max) return stage;
  }
  // Above the tallest defined range -> use the last (most mature) stage.
  if (stages.length) {
    const last = stages[stages.length - 1];
    const range = profile.stages[last].heightRange;
    if (range && h > range.max) return last;
  }
  return stages[0] || null;
}

// Guidance for a species + stage: EC target, nutrient emphasis, and care text.
// Falls back through generic stages so every species returns something useful.
export function getStageGuidance(species, stage) {
  const profile = getProfile(species);
  const generic = PLANT_PROFILES[PLANT_TYPES.GENERIC];
  const stageData =
    (profile.stages && profile.stages[stage]) ||
    (generic.stages && generic.stages[stage]) ||
    (generic.stages && generic.stages[GROWTH_STAGES.VEGETATIVE]);

  if (!stageData) return null;
  return {
    stage,
    label: stageLabel(stage),
    ec: stageData.ec,
    nutrients: stageData.nutrients,
    feeding: stageData.feeding,
    care: stageData.care,
    problems: stageData.problems || [],
    phRange: profile.phRange,
    optimalTemp: profile.optimalTemp,
    optimalHumidity: profile.optimalHumidity,
    lightRequirement: profile.lightRequirement,
  };
}
