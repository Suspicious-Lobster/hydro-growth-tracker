// Integration test for the embedded backend (server.js).
//
// Spins up the real Express app against a temporary data directory and
// exercises every endpoint over HTTP. No network or Electron required.
//
//   node test-server.mjs

import { createServer } from './server.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-test-'));
const dataFile = path.join(tmp, 'hydro-data.json');
const uploadsDir = path.join(tmp, 'uploads');

const app = createServer({ dataFile, uploadsDir });
const server = app.listen(0);
const port = server.address().port;
const base = `http://localhost:${port}`;

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name}  ${extra}`); }
};

const j = (r) => r.json();

try {
  check('health', (await j(await fetch(`${base}/`))).status === 'Backend running');

  let logs = await j(await fetch(`${base}/logs`));
  check('logs empty initially', Array.isArray(logs) && logs.length === 0);

  let feeding = await j(await fetch(`${base}/feeding`));
  check('feeding empty initially (array)', Array.isArray(feeding) && feeding.length === 0);

  // Create log (JSON)
  let r = await fetch(`${base}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Tomato', date: '2026-06-26', height: 12.5, nutrients: 'FloraGro' }),
  });
  let created = await j(r);
  check('POST /logs created', r.status === 201 && created.id === 1 && created.height === 12.5);
  check('POST /logs notes defaults empty', created.notes === '');
  check('POST /logs image_url null', created.image_url === null);

  // Validation failure
  r = await fetch(`${base}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: '', date: 'not-a-date', height: 9999 }),
  });
  let verr = await j(r);
  check('POST /logs validation 400', r.status === 400 && Array.isArray(verr.details) && verr.details.length >= 3, JSON.stringify(verr));

  // Second log to test newest-first sorting
  await new Promise((res) => setTimeout(res, 5));
  r = await fetch(`${base}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Basil', date: '2026-06-26', height: 5, nutrients: 'FloraMicro' }),
  });
  let second = await j(r);
  check('second log id=2', second.id === 2);

  logs = await j(await fetch(`${base}/logs`));
  check('GET /logs returns 2 newest-first', logs.length === 2 && logs[0].id === 2 && logs[1].id === 1);

  // PUT update (no date required)
  r = await fetch(`${base}/logs/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Tomato XL', height: 20, nutrients: 'FloraGro+', notes: 'grew fast' }),
  });
  let updated = await j(r);
  check('PUT /logs/1 updated', r.status === 200 && updated.plant_name === 'Tomato XL' && updated.height === 20 && !!updated.updated_at);

  // PUT validation
  r = await fetch(`${base}/logs/1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: '', height: 20, nutrients: 'x' }),
  });
  check('PUT validation 400', r.status === 400);

  // PUT missing
  r = await fetch(`${base}/logs/999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'X', height: 1, nutrients: 'y' }),
  });
  check('PUT missing -> 404', r.status === 404);

  // CSV export
  r = await fetch(`${base}/logs/export`);
  let csv = await r.text();
  check('CSV export content-type', (r.headers.get('content-type') || '').includes('text/csv'));
  check('CSV has header + rows', csv.includes('plant_name') && csv.includes('Tomato XL') && csv.includes('Basil'));

  // Feeding create
  r = await fetch(`${base}/feeding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Tomato XL', nutrient_type: 'General Hydroponics', ec_level: '1.2', frequency: 'daily' }),
  });
  let sched = await j(r);
  check('POST /feeding created', r.status === 201 && sched.id === 1 && sched.last_fed === null);

  feeding = await j(await fetch(`${base}/feeding`));
  check('GET /feeding returns array with 1', Array.isArray(feeding) && feeding.length === 1);

  // Feeding validation
  r = await fetch(`${base}/feeding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'NoNutrient' }),
  });
  check('POST /feeding validation 400', r.status === 400);

  // Delete single
  r = await fetch(`${base}/logs/2`, { method: 'DELETE' });
  check('DELETE /logs/2', r.status === 200);
  logs = await j(await fetch(`${base}/logs`));
  check('after delete -> 1 log', logs.length === 1 && logs[0].id === 1);

  // Delete by plant
  await fetch(`${base}/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Tomato XL', date: '2026-06-26', height: 3, nutrients: 'z' }),
  });
  r = await fetch(`${base}/logs/plant/${encodeURIComponent('Tomato XL')}`, { method: 'DELETE' });
  let delResult = await j(r);
  check('DELETE by plant removes all', r.status === 200 && delResult.deletedCount === 2);
  logs = await j(await fetch(`${base}/logs`));
  check('all Tomato XL gone', logs.length === 0);

  /* ---------------------- Plants (first-class) ---------------------- */

  r = await fetch(`${base}/plants`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cherry', variety: 'Sungold', species: 'tomato', reservoir_volume: 50 }),
  });
  let plant = await j(r);
  check('POST /plants created', r.status === 201 && plant.id > 0 && plant.name === 'Cherry' && plant.archived === false);
  check('POST /plants keeps metadata', plant.variety === 'Sungold' && plant.species === 'tomato' && plant.reservoir_volume === 50);

  r = await fetch(`${base}/plants`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cherry' }),
  });
  check('POST /plants duplicate -> 409', r.status === 409);

  let plants = await j(await fetch(`${base}/plants`));
  check('GET /plants includes new plant', plants.some((p) => p.id === plant.id));

  // Log referencing plant_id with rich measurements.
  r = await fetch(`${base}/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_id: plant.id, date: '2026-06-26', height: 30, nutrients: 'GH', ph: 6.1, ec: 1.8, ppm: 900, water_temp: 19, humidity: 65, growth_stage: 'vegetative' }),
  });
  let richLog = await j(r);
  check('POST /logs with plant_id + measurements', r.status === 201 && richLog.plant_id === plant.id && richLog.ph === 6.1 && richLog.ec === 1.8 && richLog.growth_stage === 'vegetative');
  check('POST /logs denormalizes plant_name', richLog.plant_name === 'Cherry');

  let filtered = await j(await fetch(`${base}/logs?plant_id=${plant.id}`));
  check('GET /logs?plant_id filters', filtered.length === 1 && filtered[0].id === richLog.id);

  // Rename cascades to logs.
  r = await fetch(`${base}/plants/${plant.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cherry Bomb' }),
  });
  let renamed = await j(r);
  check('PUT /plants rename', r.status === 200 && renamed.name === 'Cherry Bomb');
  filtered = await j(await fetch(`${base}/logs?plant_id=${plant.id}`));
  check('rename cascades to log plant_name', filtered[0].plant_name === 'Cherry Bomb');

  // Archive hides from default list, keeps logs.
  r = await fetch(`${base}/plants/${plant.id}/archive`, { method: 'POST' });
  check('POST /plants/:id/archive', r.status === 200);
  plants = await j(await fetch(`${base}/plants`));
  check('archived excluded by default', !plants.some((p) => p.id === plant.id));
  plants = await j(await fetch(`${base}/plants?archived=true`));
  check('archived included with ?archived=true', plants.some((p) => p.id === plant.id));
  filtered = await j(await fetch(`${base}/logs?plant_id=${plant.id}`));
  check('archive keeps logs', filtered.length === 1);

  // Hard delete cascades.
  r = await fetch(`${base}/plants/${plant.id}`, { method: 'DELETE' });
  let delPlant = await j(r);
  check('DELETE /plants cascades logs', r.status === 200 && delPlant.deletedLogs === 1);
  filtered = await j(await fetch(`${base}/logs?plant_id=${plant.id}`));
  check('logs gone after plant delete', filtered.length === 0);

  /* ---------------------- Feeding edit/delete/fed ---------------------- */

  r = await fetch(`${base}/feeding`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Basil', nutrient_type: 'GH', ec_level: '1.0', frequency: 'weekly' }),
  });
  let sched2 = await j(r);
  check('POST /feeding for edit tests', r.status === 201);

  r = await fetch(`${base}/feeding/${sched2.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Basil', nutrient_type: 'Masterblend', ec_level: '1.4', frequency: 'daily' }),
  });
  let editedSched = await j(r);
  check('PUT /feeding edits', r.status === 200 && editedSched.nutrient_type === 'Masterblend' && editedSched.frequency === 'daily');

  r = await fetch(`${base}/feeding/${sched2.id}/fed`, { method: 'POST' });
  let fedSched = await j(r);
  check('POST /feeding/:id/fed sets last_fed', r.status === 200 && !!fedSched.last_fed);

  r = await fetch(`${base}/feeding/${sched2.id}`, { method: 'DELETE' });
  check('DELETE /feeding removes', r.status === 200);
  r = await fetch(`${base}/feeding/${sched2.id}/fed`, { method: 'POST' });
  check('feeding fed on missing -> 404', r.status === 404);

  /* ---------------------------- Settings ---------------------------- */

  let settings = await j(await fetch(`${base}/settings`));
  check('GET /settings defaults metric', settings.units.length === 'cm' && settings.ppm_scale === 500);

  r = await fetch(`${base}/settings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ units: { length: 'in', temp: 'F', volume: 'bogus' }, ppm_scale: 999 }),
  });
  settings = await j(r);
  check('PUT /settings clamps enums', settings.units.length === 'in' && settings.units.temp === 'F' && settings.units.volume === 'liters' && settings.ppm_scale === 500);

  // Persistence
  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  check('data file persisted shape', Array.isArray(raw.logs) && Array.isArray(raw.schedules) && Array.isArray(raw.plants) && typeof raw.nextId === 'number' && raw.schemaVersion === 2);

  /* ---------------------------- Backup ---------------------------- */

  // Seed known data so this section doesn't depend on earlier tests' leftovers.
  await fetch(`${base}/plants`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'BackupBasil' }),
  });
  await fetch(`${base}/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'BackupBasil', date: '2026-06-30', height: 8, nutrients: 'FloraGro' }),
  });

  // Snapshot the current store.
  const backupRes = await fetch(`${base}/backup`);
  check('GET /backup content-type json', backupRes.headers.get('content-type').includes('application/json'));
  check('GET /backup is an attachment', (backupRes.headers.get('content-disposition') || '').includes('attachment'));
  const backup = await j(backupRes);
  check('GET /backup envelope shape',
    backup._type === 'hydro-growth-tracker-backup' &&
    Array.isArray(backup.data.plants) && Array.isArray(backup.data.logs));
  const snapLogs = backup.data.logs.length;
  const snapPlants = backup.data.plants.length;
  check('backup captured existing data', snapLogs > 0 && snapPlants > 0);

  // Reject junk.
  r = await fetch(`${base}/backup/restore`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hello: 'world' }),
  });
  check('POST /backup/restore rejects non-backup', r.status === 400);

  // Wipe via restore of an empty store, then confirm the data is gone.
  r = await fetch(`${base}/backup/restore`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ _type: 'hydro-growth-tracker-backup', data: { schemaVersion: 2, plants: [], logs: [], schedules: [] } }),
  });
  check('POST /backup/restore accepts empty backup', r.status === 200);
  check('restore emptied logs', (await j(await fetch(`${base}/logs`))).length === 0);

  // Restore the earlier snapshot and confirm the records came back.
  r = await fetch(`${base}/backup/restore`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backup),
  });
  const restored = await j(r);
  check('restore returns counts', r.status === 200 && restored.counts.logs === snapLogs && restored.counts.plants === snapPlants);
  check('restore round-trips logs', (await j(await fetch(`${base}/logs`))).length === snapLogs);

  // A restored store must not hand out a colliding id on the next insert.
  const maxLogId = backup.data.logs.reduce((m, l) => Math.max(m, l.id || 0), 0);
  r = await fetch(`${base}/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'Tomato', date: '2026-07-01', height: 20, nutrients: 'FloraGro' }),
  });
  const afterRestoreLog = await j(r);
  check('restore rebuilds next id (no collision)', r.status === 201 && afterRestoreLog.id > maxLogId);

  // A bare (envelope-less) v1-shaped dump is upgraded on restore.
  r = await fetch(`${base}/backup/restore`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs: [{ id: 1, plant_name: 'LegacyBush', date: '2026-01-01', height: 5 }], nextId: 2 }),
  });
  check('restore accepts bare v1 dump', r.status === 200);
  const legacyPlants = await j(await fetch(`${base}/plants`));
  check('restore migrates v1 -> first-class plant', legacyPlants.some((p) => p.name === 'LegacyBush'));

  // Backward-compat: old-shape file without schedules
  fs.writeFileSync(dataFile, JSON.stringify({ logs: [], nextId: 1 }));
  feeding = await j(await fetch(`${base}/feeding`));
  check('old-shape file -> feeding still array', Array.isArray(feeding));
} catch (e) {
  fail++;
  console.log('✗ threw:', e.message);
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
