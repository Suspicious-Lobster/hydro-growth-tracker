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

  // Nutrients text is optional (MR-37): a quick log of pH/EC/height alone is
  // a valid entry, and structured `doses` can carry the recipe instead.
  if (isNonEmptyString(nutrients) && nutrients.length > 500) {
    push('nutrients', 'Nutrients description must be less than 500 characters');
  }

  if (notes && notes.length > 1000) {
    push('notes', 'Notes must be less than 1000 characters');
  }

  const doseErr = validateDoses(body.doses);
  if (doseErr) push('doses', doseErr);

  for (const [key, label, range] of MEASUREMENT_RANGES) {
    const err = optionalRange(body[key], label, range);
    if (err) push(key, err);
  }

  return tagged;
}

// Structured dosing: up to DOSES_MAX entries of { name, ml_per_l } per log.
// Accepts the array itself or its JSON string form (a multipart POST with an
// image sends every field as text). Returns the parsed array, or null when
// the value is absent/blank, or a string error. parseDoses is shared with the
// repository so the request the validator approved is the shape stored.
export const DOSES_MAX = 10;
export const DOSE_NAME_MAX = 60;
export const DOSE_ML_MAX = 100;

export function parseDoses(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return 'Doses must be a JSON list'; }
  }
  return value;
}

export function validateDoses(value) {
  const doses = parseDoses(value);
  if (doses === null) return null;
  if (typeof doses === 'string') return doses;
  if (!Array.isArray(doses)) return 'Doses must be a list';
  if (doses.length > DOSES_MAX) return `Doses must have at most ${DOSES_MAX} entries`;
  for (const d of doses) {
    if (!d || typeof d !== 'object') return 'Each dose must be an object with name and ml_per_l';
    if (!isNonEmptyString(d.name) || d.name.trim().length > DOSE_NAME_MAX) {
      return `Each dose needs a name of 1 to ${DOSE_NAME_MAX} characters`;
    }
    const ml = parseFloat(d.ml_per_l);
    if (Number.isNaN(ml) || ml < 0 || ml > DOSE_ML_MAX) {
      return `Dose ml/L must be a number between 0 and ${DOSE_ML_MAX}`;
    }
  }
  return null;
}

// Validate a reservoir event (a full water change or a top-off). `partial`
// is true for updates, where only the changed fields are sent.
export const RESERVOIR_KINDS = ['change', 'topoff'];

export function validateReservoirEvent(body, { partial } = { partial: false }) {
  const errors = [];
  const hasPlantId = body.plant_id !== undefined && body.plant_id !== null && body.plant_id !== '';
  if (!partial && !hasPlantId) errors.push('plant_id is required');
  if (hasPlantId && Number.isNaN(parseInt(body.plant_id, 10))) errors.push('plant_id must be a number');

  if (!partial || 'date' in body) {
    if (!body.date) errors.push('Date is required');
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) || Number.isNaN(Date.parse(body.date))) {
      errors.push('Date must be a valid YYYY-MM-DD date');
    }
  }
  if (!partial || 'kind' in body) {
    if (!RESERVOIR_KINDS.includes(body.kind)) errors.push(`Kind must be one of: ${RESERVOIR_KINDS.join(', ')}`);
  }
  if (!partial || 'volume' in body) {
    if (body.volume === undefined || body.volume === null || body.volume === '') {
      errors.push('Volume is required');
    } else {
      const err = optionalRange(body.volume, 'Volume', { min: 0, max: 100000 });
      if (err) errors.push(err);
    }
  }
  const ecErr = optionalRange(body.ec, 'EC', { min: 0, max: 5 });
  if (ecErr) errors.push(ecErr);
  const phErr = optionalRange(body.ph, 'pH', { min: 0, max: 14 });
  if (phErr) errors.push(phErr);
  if (body.notes && String(body.notes).length > 500) errors.push('Notes must be less than 500 characters');
  return errors;
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

// Validate a plant payload. `partial` is true for updates, where only the
// fields being changed are sent, so `name` is checked only when present.
export function validatePlant(body, { partial } = { partial: false }) {
  const errors = [];
  if (!partial || 'name' in body) {
    if (!isNonEmptyString(body.name)) {
      errors.push('Plant name is required and must be a non-empty string');
    } else if (body.name.length > 100) {
      errors.push('Plant name must be less than 100 characters');
    }
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
