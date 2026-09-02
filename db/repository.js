// Data-access layer for the Hydro Growth Tracker backend.
//
// All persistence goes through this module. `load`/`save` own the JSON file
// (atomic writes via temp-file + rename); the entity helpers are pure-ish
// functions that mutate and return an in-memory data object so the HTTP layer
// in server.js never touches the file shape directly. This is the seam that
// would make a future swap to SQLite a localized change.

import fs from 'fs';
import path from 'path';

export const SCHEMA_VERSION = 2;

// Default settings shape.
export const defaultSettings = () => ({
  units: { length: 'cm', volume: 'liters', temp: 'C' },
  ppm_scale: 500,
  default_species: null,
});

// Default shape of the JSON data file (current schema version).
export const emptyData = () => ({
  schemaVersion: SCHEMA_VERSION,
  plants: [],
  logs: [],
  schedules: [],
  settings: defaultSettings(),
  nextId: 1,
  nextPlantId: 1,
  nextScheduleId: 1,
});

/* --------------------------- coercion helpers --------------------------- */

// Coerce an optional numeric field to a number or null. Empty/blank/invalid
// values become null so old logs and quick entries stay valid.
const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

const now = () => new Date().toISOString();

/* ------------------------------ load / save ----------------------------- */

// Merge a parsed file onto the current empty shape so fields added later are
// always present. Acts as the final field-level back-compat safety net.
export function normalize(parsed) {
  const base = emptyData();
  const merged = { ...base, ...(parsed || {}) };
  const parsedSettings = (parsed && parsed.settings) || {};
  merged.settings = {
    ...base.settings,
    ...parsedSettings,
    units: { ...base.settings.units, ...(parsedSettings.units || {}) },
  };
  return merged;
}

// Thrown when the data file EXISTS but cannot be parsed. Callers must not
// write over the file in this state; the bytes have been copied to
// `salvagePath` for the user to recover from.
export class DamagedDataFileError extends Error {
  constructor(dataFile, salvagePath, cause) {
    super(`Data file is damaged and cannot be read: ${dataFile}`);
    this.name = 'DamagedDataFileError';
    this.dataFile = dataFile;
    this.salvagePath = salvagePath;
    this.cause = cause;
  }
}

// Copy an unreadable data file's bytes to hydro-data.corrupt-<ts>.json beside
// it, once: if an earlier salvage copy already holds identical bytes, return
// its path instead of writing another (every request would otherwise add one).
function salvageDamagedFile(dataFile, bytes) {
  const dir = path.dirname(dataFile);
  const stem = path.basename(dataFile, '.json');
  const existing = fs.readdirSync(dir).filter((f) => f.startsWith(`${stem}.corrupt-`) && f.endsWith('.json'));
  for (const f of existing) {
    const p = path.join(dir, f);
    try {
      if (fs.readFileSync(p).equals(bytes)) return p;
    } catch { /* unreadable salvage copy: write a fresh one */ }
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const salvagePath = path.join(dir, `${stem}.corrupt-${ts}.json`);
  fs.writeFileSync(salvagePath, bytes);
  return salvagePath;
}

// Read the data file. A MISSING file is a fresh install and yields an empty
// store. A file that exists but does not parse is NOT an empty store: it is
// the user's data in a state we cannot read, so it is salvaged and a
// DamagedDataFileError is thrown. (Probe P3, 2026-09-02: returning emptyData()
// here let the next save overwrite a truncated file with zero plants.)
export function load(dataFile) {
  if (!fs.existsSync(dataFile)) return emptyData();
  const bytes = fs.readFileSync(dataFile);
  try {
    return normalize(JSON.parse(bytes.toString('utf8')));
  } catch (error) {
    const salvagePath = salvageDamagedFile(dataFile, bytes);
    console.error(`Data file unreadable; bytes salvaged to ${salvagePath}:`, error.message);
    throw new DamagedDataFileError(dataFile, salvagePath, error);
  }
}

// Atomic write: serialize to a temp file then rename over the target so a
// crash mid-write can never leave a truncated data file.
export function save(dataFile, data) {
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dataFile);
}

// Turn an (already schema-current) data object from an imported backup into a
// clean store ready to write: fill any missing top-level/settings fields, force
// the collections to arrays, and rebuild the id counters from the max existing
// id so a restored file can never hand out a colliding id. Callers should run a
// possibly-older backup through migrateData() first to reach the current shape.
export function prepareImport(raw) {
  const data = normalize(raw);
  data.plants = Array.isArray(data.plants) ? data.plants : [];
  data.logs = Array.isArray(data.logs) ? data.logs : [];
  data.schedules = Array.isArray(data.schedules) ? data.schedules : [];
  const nextAfter = (rows) => rows.reduce((m, r) => Math.max(m, Number(r?.id) || 0), 0) + 1;
  data.nextPlantId = Math.max(Number(data.nextPlantId) || 1, nextAfter(data.plants));
  data.nextId = Math.max(Number(data.nextId) || 1, nextAfter(data.logs));
  data.nextScheduleId = Math.max(Number(data.nextScheduleId) || 1, nextAfter(data.schedules));
  data.schemaVersion = SCHEMA_VERSION;
  return data;
}

/* -------------------------------- plants -------------------------------- */

export function listPlants(data, { includeArchived = false } = {}) {
  const plants = includeArchived ? data.plants : data.plants.filter((p) => !p.archived);
  return [...plants].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPlant(data, id) {
  return data.plants.find((p) => p.id === id) || null;
}

export function findPlantByName(data, name) {
  if (!name) return null;
  const trimmed = String(name).trim();
  return data.plants.find((p) => p.name === trimmed) || null;
}

export function createPlant(data, body) {
  const ts = now();
  const plant = {
    id: data.nextPlantId,
    name: String(body.name).trim(),
    variety: body.variety ? String(body.variety) : null,
    species: body.species || null,
    system_type: body.system_type || null,
    reservoir_volume: num(body.reservoir_volume),
    reservoir_unit: body.reservoir_unit || 'liters',
    start_date: body.start_date || null,
    target_stage: body.target_stage || null,
    archived: false,
    created_at: ts,
    updated_at: ts,
  };
  data.plants.push(plant);
  data.nextPlantId += 1;
  return plant;
}

// Update a plant. When the name changes, cascade the denormalized plant_name
// cache to that plant's logs and schedules in the same write.
export function updatePlant(data, id, body) {
  const plant = getPlant(data, id);
  if (!plant) return null;

  const oldName = plant.name;
  if (body.name !== undefined) plant.name = String(body.name).trim();
  for (const f of ['variety', 'species', 'system_type', 'reservoir_unit', 'start_date', 'target_stage']) {
    if (body[f] !== undefined) plant[f] = body[f] === '' ? null : body[f];
  }
  if (body.reservoir_volume !== undefined) plant.reservoir_volume = num(body.reservoir_volume);
  if (body.archived !== undefined) plant.archived = !!body.archived;
  plant.updated_at = now();

  if (plant.name !== oldName) {
    for (const log of data.logs) if (log.plant_id === plant.id) log.plant_name = plant.name;
    for (const s of data.schedules) if (s.plant_id === plant.id) s.plant_name = plant.name;
  }
  return plant;
}

export function archivePlant(data, id) {
  const plant = getPlant(data, id);
  if (!plant) return null;
  plant.archived = true;
  plant.updated_at = now();
  return plant;
}

// Hard delete a plant and cascade-remove its logs and schedules.
export function deletePlantCascade(data, id) {
  const plant = getPlant(data, id);
  if (!plant) return null;
  const logsBefore = data.logs.length;
  data.plants = data.plants.filter((p) => p.id !== id);
  data.logs = data.logs.filter((l) => l.plant_id !== id);
  data.schedules = data.schedules.filter((s) => s.plant_id !== id);
  return { plant, deletedLogs: logsBefore - data.logs.length };
}

// Resolve the plant a log/schedule refers to. Prefers plant_id; falls back to
// plant_name, auto-creating a plant for it (back-compat with name-only POSTs).
export function resolvePlant(data, body) {
  const { plant_id, plant_name } = body;
  if (plant_id !== undefined && plant_id !== null && plant_id !== '') {
    return getPlant(data, parseInt(plant_id, 10));
  }
  if (plant_name && String(plant_name).trim()) {
    return findPlantByName(data, plant_name) || createPlant(data, { name: plant_name });
  }
  return null;
}

/* --------------------------------- logs --------------------------------- */

export function listLogs(data, { plant_id } = {}) {
  let logs = data.logs;
  if (plant_id !== undefined && plant_id !== null && plant_id !== '') {
    const pid = parseInt(plant_id, 10);
    logs = logs.filter((l) => l.plant_id === pid);
  }
  return [...logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getLog(data, id) {
  return data.logs.find((l) => l.id === id) || null;
}

// Build the optional measurement fields shared by create and update.
function measurementFields(body) {
  return {
    growth_stage: body.growth_stage || null,
    ph: num(body.ph),
    ec: num(body.ec),
    ppm: num(body.ppm),
    water_temp: num(body.water_temp),
    air_temp: num(body.air_temp),
    temp_unit: body.temp_unit === 'F' ? 'F' : 'C',
    humidity: num(body.humidity),
    light_hours: num(body.light_hours),
    reservoir_volume: num(body.reservoir_volume),
  };
}

export function createLog(data, body) {
  const plant = resolvePlant(data, body);
  const log = {
    id: data.nextId,
    plant_id: plant ? plant.id : null,
    plant_name: plant ? plant.name : (body.plant_name ? String(body.plant_name).trim() : ''),
    date: body.date,
    height: parseFloat(body.height),
    height_unit: body.height_unit === 'in' ? 'in' : 'cm',
    ...measurementFields(body),
    nutrients: body.nutrients ? String(body.nutrients).trim() : '',
    notes: body.notes ? String(body.notes).trim() : '',
    image_url: body.image_url || null,
    created_at: now(),
  };
  data.logs.push(log);
  data.nextId += 1;
  return log;
}

// Update a log. Date and image are preserved (the edit form does not resend
// them), matching the original PUT semantics.
export function updateLog(data, id, body) {
  const log = getLog(data, id);
  if (!log) return null;

  // Allow re-pointing a log at a different plant via plant_id/plant_name.
  if ((body.plant_id !== undefined && body.plant_id !== '') ||
      (body.plant_name !== undefined && body.plant_name !== log.plant_name)) {
    const plant = resolvePlant(data, body);
    if (plant) {
      log.plant_id = plant.id;
      log.plant_name = plant.name;
    } else if (body.plant_name) {
      log.plant_name = String(body.plant_name).trim();
    }
  }

  if (body.height !== undefined) log.height = parseFloat(body.height);
  if (body.height_unit !== undefined) log.height_unit = body.height_unit === 'in' ? 'in' : 'cm';
  // Only touch measurement fields the caller actually sent. A field present and
  // explicitly null clears it; an absent field keeps its stored value (so the
  // partial edit form can't wipe measurements it never showed).
  if ('growth_stage' in body) log.growth_stage = body.growth_stage || null;
  if (body.temp_unit !== undefined) log.temp_unit = body.temp_unit === 'F' ? 'F' : 'C';
  for (const f of ['ph', 'ec', 'ppm', 'water_temp', 'air_temp', 'humidity', 'light_hours', 'reservoir_volume']) {
    if (f in body) log[f] = num(body[f]);
  }
  if (body.nutrients !== undefined) log.nutrients = String(body.nutrients).trim();
  if (body.notes !== undefined) log.notes = body.notes ? String(body.notes).trim() : '';
  log.updated_at = now();
  return log;
}

export function deleteLog(data, id) {
  const idx = data.logs.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const [deleted] = data.logs.splice(idx, 1);
  return deleted;
}

export function deleteLogsByPlantName(data, plantName) {
  const before = data.logs.length;
  data.logs = data.logs.filter((l) => l.plant_name !== plantName);
  return before - data.logs.length;
}

/* ------------------------------- schedules ------------------------------ */

export function listSchedules(data) {
  return data.schedules;
}

export function getSchedule(data, id) {
  return data.schedules.find((s) => s.id === id) || null;
}

export function createSchedule(data, body) {
  const plant = resolvePlant(data, body);
  const ts = now();
  const schedule = {
    id: data.nextScheduleId,
    plant_id: plant ? plant.id : null,
    plant_name: plant ? plant.name : (body.plant_name || ''),
    nutrient_type: body.nutrient_type,
    ec_level: body.ec_level || '',
    frequency: body.frequency || 'daily',
    custom_interval_days:
      body.frequency === 'custom' ? parseInt(body.custom_interval_days, 10) || null : null,
    notes: body.notes || '',
    last_fed: null,
    active: true,
    created_at: ts,
    updated_at: ts,
  };
  data.schedules.push(schedule);
  data.nextScheduleId += 1;
  return schedule;
}

export function updateSchedule(data, id, body) {
  const schedule = getSchedule(data, id);
  if (!schedule) return null;
  if ((body.plant_id !== undefined && body.plant_id !== '') || body.plant_name !== undefined) {
    const plant = resolvePlant(data, body);
    if (plant) {
      schedule.plant_id = plant.id;
      schedule.plant_name = plant.name;
    }
  }
  for (const f of ['nutrient_type', 'ec_level', 'frequency', 'notes']) {
    if (body[f] !== undefined) schedule[f] = body[f];
  }
  if (body.custom_interval_days !== undefined) {
    schedule.custom_interval_days = parseInt(body.custom_interval_days, 10) || null;
  }
  if (body.active !== undefined) schedule.active = !!body.active;
  schedule.updated_at = now();
  return schedule;
}

export function deleteSchedule(data, id) {
  const idx = data.schedules.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const [deleted] = data.schedules.splice(idx, 1);
  return deleted;
}

export function markFed(data, id) {
  const schedule = getSchedule(data, id);
  if (!schedule) return null;
  schedule.last_fed = now();
  schedule.updated_at = schedule.last_fed;
  return schedule;
}

/* -------------------------------- settings ------------------------------ */

export function getSettings(data) {
  return data.settings;
}

// Merge a settings patch, clamping every enum to a known value.
export function updateSettings(data, body) {
  const s = data.settings;
  if (body.units) {
    if (['cm', 'in'].includes(body.units.length)) s.units.length = body.units.length;
    if (['liters', 'gallons'].includes(body.units.volume)) s.units.volume = body.units.volume;
    if (['C', 'F'].includes(body.units.temp)) s.units.temp = body.units.temp;
  }
  if (body.ppm_scale === 500 || body.ppm_scale === 700) s.ppm_scale = body.ppm_scale;
  if ('default_species' in body) s.default_species = body.default_species || null;
  return s;
}
