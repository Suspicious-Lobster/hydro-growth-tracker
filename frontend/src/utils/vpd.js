// Vapour-pressure deficit (VPD): how thirsty the air is relative to what the
// leaf surface is releasing. Too low and the plant can't transpire (stagnant,
// mould-prone air); too high and it wilts trying to keep up. Computed from
// air temperature + relative humidity using the Tetens saturation-vapour-
// pressure approximation, with a small leaf-surface temperature offset (leaves
// commonly run a couple of degrees cooler than the air around them).
import { GROWTH_STAGES } from '../data/plantKnowledge';

// Tetens saturation vapour pressure at temperature T (°C), in kPa.
function saturationVapourPressure(tempC) {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

// vpdKpa(airTempC, humidityPct, leafOffsetC = -2): VPD in kPa, rounded to 2dp.
// null when either input is missing so callers can skip the check cleanly.
export function vpdKpa(airTempC, humidityPct, leafOffsetC = -2) {
  if (airTempC === null || airTempC === undefined || humidityPct === null || humidityPct === undefined) {
    return null;
  }
  const air = parseFloat(airTempC);
  const rh = parseFloat(humidityPct);
  if (Number.isNaN(air) || Number.isNaN(rh)) return null;

  const leafTempC = air + leafOffsetC;
  const esLeaf = saturationVapourPressure(leafTempC);
  const esAir = saturationVapourPressure(air);
  const vpd = esLeaf - esAir * (rh / 100);
  return Math.round(vpd * 100) / 100;
}

// Ideal VPD band per growth stage, in kPa.
export const VPD_BANDS = {
  [GROWTH_STAGES.SEEDLING]: { min: 0.4, max: 0.8 },
  [GROWTH_STAGES.EARLY_VEG]: { min: 0.4, max: 0.8 },
  [GROWTH_STAGES.VEGETATIVE]: { min: 0.8, max: 1.2 },
  [GROWTH_STAGES.PRE_FLOWER]: { min: 0.8, max: 1.2 },
  [GROWTH_STAGES.EARLY_FLOWER]: { min: 1.2, max: 1.6 },
  [GROWTH_STAGES.MID_FLOWER]: { min: 1.2, max: 1.6 },
  [GROWTH_STAGES.LATE_FLOWER]: { min: 1.2, max: 1.6 },
  [GROWTH_STAGES.HARVEST]: { min: 1.2, max: 1.6 },
};

// vpdBand(stage): { min, max } for a growth stage, or null when the stage is
// missing/unrecognized (so callers can skip the check rather than fabricate
// a range).
export function vpdBand(stage) {
  return VPD_BANDS[stage] || null;
}
