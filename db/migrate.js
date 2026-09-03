// Versioned, non-destructive migration for the Hydro Growth Tracker data file.
//
// v1 (the original shape) keyed everything by `plant_name` and had no
// first-class plant entity. v2 introduces a `plants` collection, links logs and
// schedules by `plant_id`, adds measurement fields, and seeds settings.
//
// `migrateData` is a pure transform (used by tests). `runMigration` wraps it
// with a mandatory backup and an atomic write, and is invoked once at startup.

import fs from 'fs';
import path from 'path';
import { SCHEMA_VERSION, emptyData, defaultSettings, save } from './repository.js';

const SENTINEL_NUTRIENTS = 'Initial setup';
const SENTINEL_NOTES_PREFIX = 'Plant added';

// A "sentinel" log is the fake entry the old PlantManager created just to make
// a plant appear. We strip these but keep the plant they introduced. Detection
// is conservative (all three markers must match) to never nuke real data.
function isSentinel(log) {
  return (
    parseFloat(log.height) === 0 &&
    log.nutrients === SENTINEL_NUTRIENTS &&
    typeof log.notes === 'string' &&
    log.notes.startsWith(SENTINEL_NOTES_PREFIX)
  );
}

// Thrown when a file or backup carries a schemaVersion this build does not
// know. Treating it as v1 would strip every field the newer version added
// (probe P4, 2026-09-02), so the only safe move is to refuse and say why.
export class SchemaTooNewError extends Error {
  constructor(found, supported = SCHEMA_VERSION) {
    super(`This data was written by a newer version of Hydro Growth Tracker (schema v${found}; this app supports up to v${supported}). Update the app to open it.`);
    this.name = 'SchemaTooNewError';
    this.found = found;
    this.supported = supported;
  }
}

export const isTooNew = (raw) =>
  raw != null && typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION;

// Transform a raw (possibly v1) data object into the current schema. Returns
// `{ data, changed }`. Idempotent: a v2 input is returned unchanged. Throws
// SchemaTooNewError (without touching the input) for a newer schema.
export function migrateData(raw) {
  if (isTooNew(raw)) throw new SchemaTooNewError(raw.schemaVersion);
  if (raw && raw.schemaVersion === SCHEMA_VERSION) {
    return { data: raw, changed: false };
  }

  const base = emptyData();
  const rawLogs = Array.isArray(raw?.logs) ? raw.logs.map((l) => ({ ...l })) : [];
  const rawSchedules = Array.isArray(raw?.schedules) ? raw.schedules.map((s) => ({ ...s })) : [];

  // 1. Derive plants from distinct plant_name, in first-seen order. created_at
  //    is the earliest known timestamp for that name. Both logs AND schedules
  //    seed plants, so a v1 plant referenced only by a feeding schedule (no
  //    growth logs) still becomes a first-class plant instead of being lost.
  const nameToPlant = new Map();
  let nextPlantId = 1;
  const seenName = (name, created) => {
    if (!name) return;
    if (nameToPlant.has(name)) {
      const p = nameToPlant.get(name);
      if (created && new Date(created) < new Date(p.created_at)) p.created_at = created;
      return;
    }
    const ts = created || new Date().toISOString();
    nameToPlant.set(name, {
      id: nextPlantId++,
      name,
      variety: null,
      species: null,
      system_type: null,
      reservoir_volume: null,
      reservoir_unit: 'liters',
      start_date: null,
      target_stage: null,
      archived: false,
      created_at: ts,
      updated_at: ts,
    });
  };
  for (const log of rawLogs) seenName(log.plant_name, log.created_at);
  for (const s of rawSchedules) seenName(s.plant_name, s.created_at);

  // 2. Strip sentinel logs; use their date as the plant's start_date.
  const logs = [];
  for (const log of rawLogs) {
    if (isSentinel(log)) {
      const plant = nameToPlant.get(log.plant_name);
      if (plant && log.date) plant.start_date = plant.start_date || log.date;
      continue;
    }
    logs.push(log);
  }

  // 3. Relink remaining logs to their plant; backfill implicit units + nulls.
  for (const log of logs) {
    const plant = nameToPlant.get(log.plant_name);
    log.plant_id = plant ? plant.id : null;
    log.height_unit = log.height_unit || 'cm';
    log.growth_stage = log.growth_stage ?? null;
    log.temp_unit = log.temp_unit || 'C';
    for (const f of ['ph', 'ec', 'ppm', 'water_temp', 'air_temp', 'humidity', 'light_hours', 'reservoir_volume']) {
      if (log[f] === undefined) log[f] = null;
    }
  }

  // 4. Relink schedules by name (null if the name had no logs).
  for (const s of rawSchedules) {
    const plant = nameToPlant.get(s.plant_name);
    s.plant_id = plant ? plant.id : null;
    if (s.active === undefined) s.active = true;
    if (s.custom_interval_days === undefined) s.custom_interval_days = null;
    if (!s.updated_at) s.updated_at = s.created_at || new Date().toISOString();
  }

  const plants = Array.from(nameToPlant.values());
  const maxLogId = logs.reduce((m, l) => Math.max(m, l.id || 0), 0);
  const maxSchedId = rawSchedules.reduce((m, s) => Math.max(m, s.id || 0), 0);

  const data = {
    schemaVersion: SCHEMA_VERSION,
    plants,
    logs,
    schedules: rawSchedules,
    settings: raw?.settings ? { ...defaultSettings(), ...raw.settings } : defaultSettings(),
    nextId: Math.max(raw?.nextId || 1, maxLogId + 1),
    nextPlantId,
    nextScheduleId: Math.max(raw?.nextScheduleId || 1, maxSchedId + 1),
  };

  return { data, changed: true };
}

// Run the migration against a data file on disk. Backs the file up first
// (aborting if the backup cannot be written), then writes the migrated data
// atomically. No-op if the file is already current or unreadable.
export function runMigration(dataFile) {
  if (!fs.existsSync(dataFile)) return { migrated: false };

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (error) {
    console.error('Migration skipped: data file unreadable:', error.message);
    return { migrated: false };
  }

  if (raw && raw.schemaVersion === SCHEMA_VERSION) return { migrated: false };
  // A newer file is left exactly as it is on disk; the caller refuses to serve it.
  if (isTooNew(raw)) return { migrated: false, tooNew: true, found: raw.schemaVersion };

  // Mandatory backup before touching anything.
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(path.dirname(dataFile), `hydro-data.backup.v1-${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(raw, null, 2));

  const { data } = migrateData(raw);
  save(dataFile, data); // atomic temp-file + rename, shared with the repository

  console.log(`Migrated data file to schema v${SCHEMA_VERSION}. Backup: ${backupPath}`);
  return { migrated: true, backupPath };
}
