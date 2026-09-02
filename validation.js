// Request validation for the Hydro Growth Tracker backend. Centralized here so
// the HTTP layer stays thin and the rules are unit-testable in isolation.

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// Validate an optional numeric field. Returns an error string or null. Blank
// values are allowed (the field is optional).
function optionalRange(value, label, { min, max }) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return `${label} must be a number`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}`;
  return null;
}

// Optional measurement fields shared by create and update of a log.
export const MEASUREMENT_RANGES = [
  ['ph', 'pH', { min: 0, max: 14 }],
  ['ec', 'EC', { min: 0, max: 5 }],
  ['ppm', 'PPM', { min: 0, max: 3000 }],
  ['humidity', 'Humidity', { min: 0, max: 100 }],
  ['light_hours', 'Light hours', { min: 0, max: 24 }],
  ['water_temp', 'Water temperature', { min: -50, max: 100 }],
  ['air_temp', 'Air temperature', { min: -50, max: 100 }],
  ['reservoir_volume', 'Reservoir volume', { min: 0, max: 100000 }],
];

// Runs every log rule once, tagging each message with the field it belongs
// to. `validateLog` and `validateLogByField` both project from this so the
// rule table (and its bounds/wording) has exactly one derivation.
function runLogRules(body, { requireDate } = { requireDate: true }) {
  const { plant_name, plant_id, date, height, nutrients, notes, height_unit } = body;
  const tagged = [];
  const push = (field, message) => tagged.push({ field, message });

  // A log must identify a plant by id or by (non-empty) name.
  const hasPlantId = plant_id !== undefined && plant_id !== null && plant_id !== '';
  if (!hasPlantId) {
    if (!isNonEmptyString(plant_name)) {
      push('plant', 'Plant name is required and must be a non-empty string');
    } else if (plant_name.length > 100) {
      push('plant', 'Plant name must be less than 100 characters');
    }
  }

  if (requireDate) {
    if (!date) push('date', 'Date is required');
    else if (Number.isNaN(Date.parse(date))) push('date', 'Date must be a valid date format');
  }

  const unit = height_unit === 'in' ? 'in' : 'cm';
  const maxHeight = unit === 'in' ? 400 : 1000;
  if (height === undefined || height === null || height === '') {
    push('height', 'Height is required');
  } else {
    const h = parseFloat(height);
    if (Number.isNaN(h) || h < 0 || h > maxHeight) {
      push('height', `Height must be a number between 0 and ${maxHeight} ${unit}`);
    }
  }

  if (!isNonEmptyString(nutrients)) {
    push('nutrients', 'Nutrients information is required');
  } else if (nutrients.length > 500) {
    push('nutrients', 'Nutrients description must be less than 500 characters');
  }

  if (notes && notes.length > 1000) {
    push('notes', 'Notes must be less than 1000 characters');
  }

  for (const [key, label, range] of MEASUREMENT_RANGES) {
    const err = optionalRange(body[key], label, range);
    if (err) push(key, err);
  }

  return tagged;
}

// Validate a log payload. `requireDate` is false for updates, where the edit
// form does not resend the date.
export function validateLog(body, opts = { requireDate: true }) {
  return runLogRules(body, opts).map((e) => e.message);
}

// Same rules as validateLog, keyed by field name -> first message for that
// field. Lets a caller (the client form) render inline errors without
// re-implementing any rule or bound.
export function validateLogByField(body, opts = { requireDate: true }) {
  const byField = {};
  for (const { field, message } of runLogRules(body, opts)) {
    if (!(field in byField)) byField[field] = message;
  }
  return byField;
}

// Validate a plant payload (create/update).
export function validatePlant(body) {
  const errors = [];
  if (!isNonEmptyString(body.name)) {
    errors.push('Plant name is required and must be a non-empty string');
  } else if (body.name.length > 100) {
    errors.push('Plant name must be less than 100 characters');
  }
  for (const [k, label] of [
    ['variety', 'Variety'],
    ['species', 'Species'],
    ['system_type', 'System type'],
    ['target_stage', 'Target stage'],
  ]) {
    if (typeof body[k] === 'string' && body[k].length > 100) {
      errors.push(`${label} must be less than 100 characters`);
    }
  }
  const resErr = optionalRange(body.reservoir_volume, 'Reservoir volume', { min: 0, max: 100000 });
  if (resErr) errors.push(resErr);
  if (body.start_date && Number.isNaN(Date.parse(body.start_date))) {
    errors.push('Start date must be a valid date format');
  }
  return errors;
}

// Validate a feeding-schedule payload. `partial` is true for updates, where the
// edit form may send only the fields being changed, so absent fields are left
// alone instead of being required.
export function validateSchedule(body, { partial } = { partial: false }) {
  const errors = [];
  const hasPlantId = body.plant_id !== undefined && body.plant_id !== null && body.plant_id !== '';

  if (!partial || hasPlantId || 'plant_name' in body) {
    if (!hasPlantId && !isNonEmptyString(body.plant_name)) {
      errors.push('Plant name is required');
    }
  }
  if (!partial || 'nutrient_type' in body) {
    if (!isNonEmptyString(body.nutrient_type)) {
      errors.push('Nutrient type is required');
    }
  }
  const validFreq = ['daily', 'every-2-days', 'weekly', 'custom'];
  if (body.frequency && !validFreq.includes(body.frequency)) {
    errors.push(`Frequency must be one of: ${validFreq.join(', ')}`);
  }
  if (body.frequency === 'custom') {
    const n = parseInt(body.custom_interval_days, 10);
    if (Number.isNaN(n) || n < 1 || n > 365) {
      errors.push('Custom interval must be a number of days between 1 and 365');
    }
  }
  return errors;
}
