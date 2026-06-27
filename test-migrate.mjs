// Migration tests for the v1 -> v2 data-file transform.
//
//   node test-migrate.mjs

import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrateData, runMigration } from './db/migrate.js';
import { SCHEMA_VERSION } from './db/repository.js';

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}  ${extra}`); }
};

try {
  /* ---- Pure transform of a representative v1 file ---- */
  const v1 = {
    logs: [
      { id: 1, plant_name: 'Tomato', date: '2026-01-01', height: 0, nutrients: 'Initial setup', notes: 'Plant added to tracking system', created_at: '2026-01-01T00:00:00.000Z' },
      { id: 2, plant_name: 'Tomato', date: '2026-01-05', height: 12, nutrients: 'FloraGro', notes: 'growing', created_at: '2026-01-05T00:00:00.000Z' },
      { id: 3, plant_name: 'Basil', date: '2026-01-03', height: 4, nutrients: 'FloraMicro', notes: '', created_at: '2026-01-03T00:00:00.000Z' },
      { id: 4, plant_name: 'Lonely', date: '2026-01-02', height: 0, nutrients: 'Initial setup', notes: 'Plant added to tracking system', created_at: '2026-01-02T00:00:00.000Z' },
    ],
    schedules: [
      { id: 1, plant_name: 'Tomato', nutrient_type: 'GH', ec_level: '1.2', frequency: 'daily', notes: '', last_fed: null, created_at: '2026-01-05T00:00:00.000Z' },
      { id: 1, plant_name: 'GhostPlant', nutrient_type: 'GH', ec_level: '1.0', frequency: 'weekly', notes: '', last_fed: null, created_at: '2026-01-05T00:00:00.000Z' },
    ],
    nextId: 5,
    nextScheduleId: 2,
  };

  const { data, changed } = migrateData(JSON.parse(JSON.stringify(v1)));
  check('migration ran', changed === true);
  check('schemaVersion bumped', data.schemaVersion === SCHEMA_VERSION);

  // Plants derived from distinct names, including the sentinel-only "Lonely".
  const names = data.plants.map((p) => p.name).sort();
  check('plants derived from names', JSON.stringify(names) === JSON.stringify(['Basil', 'Lonely', 'Tomato']));

  const tomato = data.plants.find((p) => p.name === 'Tomato');
  const lonely = data.plants.find((p) => p.name === 'Lonely');
  check('plant created_at = earliest log', tomato.created_at === '2026-01-01T00:00:00.000Z');

  // Sentinel logs stripped; real logs kept and linked.
  check('sentinel logs removed', data.logs.length === 2);
  check('no Initial setup remains', !data.logs.some((l) => l.nutrients === 'Initial setup'));
  const tomatoLog = data.logs.find((l) => l.plant_name === 'Tomato');
  check('log linked to plant_id', tomatoLog.plant_id === tomato.id);
  check('log backfilled height_unit', tomatoLog.height_unit === 'cm');
  check('log backfilled measurement nulls', tomatoLog.ph === null && tomatoLog.ec === null);

  // Sentinel-only plant preserved with its date as start_date and no logs.
  check('sentinel-only plant kept', !!lonely);
  check('sentinel-only plant has start_date', lonely.start_date === '2026-01-02');
  check('sentinel-only plant has zero logs', !data.logs.some((l) => l.plant_id === lonely.id));

  // Schedules linked; unknown name -> null plant_id.
  const tSched = data.schedules.find((s) => s.plant_name === 'Tomato');
  const gSched = data.schedules.find((s) => s.plant_name === 'GhostPlant');
  check('schedule linked to plant', tSched.plant_id === tomato.id && tSched.active === true);
  check('orphan schedule plant_id null', gSched.plant_id === null);

  check('settings seeded metric', data.settings.units.length === 'cm' && data.settings.ppm_scale === 500);
  check('nextPlantId set', data.nextPlantId === 4);

  // Idempotency.
  const again = migrateData(data);
  check('idempotent on v2', again.changed === false);

  /* ---- runMigration on disk: backup + atomic write ---- */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-migrate-'));
  const dataFile = path.join(tmp, 'hydro-data.json');
  fs.writeFileSync(dataFile, JSON.stringify(v1));
  const result = runMigration(dataFile);
  check('runMigration migrated', result.migrated === true);
  check('backup file created', fs.existsSync(result.backupPath));
  const onDisk = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  check('on-disk file is v2', onDisk.schemaVersion === SCHEMA_VERSION && onDisk.plants.length === 3);
  // Second run is a no-op.
  const second = runMigration(dataFile);
  check('runMigration no-op on v2', second.migrated === false);
  fs.rmSync(tmp, { recursive: true, force: true });

  /* ---- Legacy {logs, nextId} shape (no schedules) ---- */
  const legacy = migrateData({ logs: [{ id: 1, plant_name: 'X', height: 5, nutrients: 'n', notes: '', created_at: '2026-01-01T00:00:00.000Z' }], nextId: 2 });
  check('legacy shape migrates', legacy.data.plants.length === 1 && Array.isArray(legacy.data.schedules));
} catch (e) {
  fail++;
  console.log('✗ threw:', e.message, e.stack);
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
