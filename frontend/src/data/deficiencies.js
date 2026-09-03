// Deficiency diagnosis helper's brain: a PURE, DOM-free ranking engine. Given a
// list of ticked symptom ids, it scores each known issue by summed weight and
// returns the ranked matches (ties broken alphabetically by label). No React,
// no DOM — unit testable alongside the other data/*.js engines.
//
// Tone: playful but honest — this is a best guess, not a lab test.

// The checkbox list shown in the UI. Ids are stable and referenced by ISSUES below.
export const SYMPTOMS = [
  { id: 'yellowing_lower', label: 'Yellowing lower leaves' },
  { id: 'yellowing_upper', label: 'Yellowing upper leaves' },
  { id: 'interveinal_chlorosis', label: 'Interveinal chlorosis (green veins, yellow between)' },
  { id: 'purple_stems', label: 'Purple stems' },
  { id: 'brown_edges', label: 'Brown leaf edges' },
  { id: 'curling', label: 'Curling leaves' },
  { id: 'brown_spots', label: 'Brown spots' },
  { id: 'blossom_end_rot', label: 'Blossom end rot' },
  { id: 'stunted', label: 'Stunted growth' },
  { id: 'wilting_wet', label: 'Wilting with wet roots' },
  { id: 'dark_clawed', label: 'Dark green, clawed leaves' },
  { id: 'powdery', label: 'White powdery coating' },
  { id: 'brown_roots', label: 'Slimy or brown roots' },
  { id: 'pale_new', label: 'Pale new growth' },
];

const SYMPTOM_LABELS = SYMPTOMS.reduce((acc, s) => { acc[s.id] = s.label; return acc; }, {});

// Each issue lists the symptom ids it's associated with and a weight (how
// strongly that symptom points to this issue), plus a short fix.
export const ISSUES = [
  {
    id: 'nitrogen',
    label: 'Nitrogen deficiency',
    symptoms: { yellowing_lower: 3, stunted: 2, pale_new: 1 },
    fix: 'Bump up nitrogen in your feed — a balanced grow-stage nutrient dose should green things back up.',
  },
  {
    id: 'phosphorus',
    label: 'Phosphorus deficiency',
    symptoms: { purple_stems: 3, stunted: 1 },
    fix: 'Add a phosphorus-rich bloom nutrient and check reservoir temp — cold roots struggle to take up phosphorus.',
  },
  {
    id: 'potassium',
    label: 'Potassium deficiency',
    symptoms: { brown_edges: 3, brown_spots: 1 },
    fix: 'Work in a potassium supplement; brown, crispy edges usually clear up within a week or two.',
  },
  {
    id: 'calcium',
    label: 'Calcium deficiency',
    symptoms: { blossom_end_rot: 3, brown_spots: 1, curling: 1 },
    fix: 'Add cal-mag and keep watering consistent — irregular watering blocks calcium uptake even when it is in the mix.',
  },
  {
    id: 'magnesium',
    label: 'Magnesium deficiency',
    symptoms: { interveinal_chlorosis: 3 },
    fix: 'A dose of Epsom salt or cal-mag usually clears the yellow-between-green-veins look within days.',
  },
  {
    id: 'iron',
    label: 'Iron deficiency',
    symptoms: { interveinal_chlorosis: 2, pale_new: 2, yellowing_upper: 2 },
    fix: 'Check pH first (iron locks out above ~6.5), then add a chelated iron supplement if needed.',
  },
  {
    id: 'overfeeding',
    label: 'Nutrient overfeeding',
    symptoms: { dark_clawed: 3 },
    fix: 'Flush with plain pH-balanced water for a feeding or two, then come back in lighter.',
  },
  {
    id: 'root_rot',
    label: 'Root rot',
    symptoms: { brown_roots: 3, wilting_wet: 3 },
    fix: 'Trim off mushy roots, raise reservoir oxygen (air stone), and add a beneficial-bacteria or peroxide rinse.',
  },
  {
    id: 'ph_lockout',
    label: 'pH lockout',
    symptoms: { interveinal_chlorosis: 1, yellowing_upper: 1, stunted: 1, brown_spots: 1 },
    fix: 'check pH first',
  },
  {
    id: 'powdery_mildew',
    label: 'Powdery mildew',
    symptoms: { powdery: 4 },
    fix: 'Improve airflow, trim crowded leaves, and treat with a milk or potassium bicarbonate spray.',
  },
];

// Ranks issues by summed weight for the given ticked symptom ids. Only issues
// with a positive score are returned. Ties break alphabetically by label.
// Each result also carries `why` — the matched symptom labels, comma-joined —
// so the UI can show what drove the match.
export function diagnose(symptomIds) {
  if (!symptomIds || symptomIds.length === 0) return [];
  const ticked = new Set(symptomIds);

  const results = ISSUES.map((issue) => {
    let score = 0;
    const matched = [];
    for (const [symptomId, weight] of Object.entries(issue.symptoms)) {
      if (ticked.has(symptomId)) {
        score += weight;
        matched.push(SYMPTOM_LABELS[symptomId] || symptomId);
      }
    }
    return { ...issue, score, why: matched.join(', ') };
  }).filter((r) => r.score > 0);

  results.sort((a, b) => (b.score - a.score) || a.label.localeCompare(b.label));
  return results;
}
