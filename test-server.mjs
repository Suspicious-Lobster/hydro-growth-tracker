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

  /* ---------------------- pH support ---------------------- */

  r = await fetch(`${base}/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'PhPlant', date: '2026-06-26', height: 4, nutrients: 'x', ph: 6.2 }),
  });
  let phLog = await j(r);
  check('POST /logs stores ph', r.status === 201 && phLog.ph === 6.2);

  r = await fetch(`${base}/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'PhPlant2', date: '2026-06-26', height: 4, nutrients: 'x' }),
  });
  let noPhLog = await j(r);
  check('POST /logs ph defaults null', r.status === 201 && noPhLog.ph === null);

  r = await fetch(`${base}/logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'PhBad', date: '2026-06-26', height: 4, nutrients: 'x', ph: 99 }),
  });
  check('POST /logs invalid ph -> 400', r.status === 400);

  r = await fetch(`${base}/logs/${phLog.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'PhPlant', height: 4, nutrients: 'x', ph: 5.5, date: '2026-07-01' }),
  });
  let phUpdated = await j(r);
  check('PUT /logs updates ph and date', r.status === 200 && phUpdated.ph === 5.5 && phUpdated.date === '2026-07-01');

  r = await fetch(`${base}/logs/export`);
  let csv2 = await r.text();
  check('CSV includes date and ph columns', csv2.includes('date') && csv2.includes('ph'));

  /* ---------------------- Plant rename ---------------------- */

  r = await fetch(`${base}/logs/plant/${encodeURIComponent('PhPlant')}/rename`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: 'RenamedPlant' }),
  });
  let renameResult = await j(r);
  check('rename plant ok', r.status === 200 && renameResult.renamed === 1);
  logs = await j(await fetch(`${base}/logs`));
  check('rename applied to logs', logs.some((l) => l.plant_name === 'RenamedPlant') && !logs.some((l) => l.plant_name === 'PhPlant'));

  r = await fetch(`${base}/logs/plant/${encodeURIComponent('PhPlant')}/rename`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: 'X' }),
  });
  check('rename missing plant -> 404', r.status === 404);

  r = await fetch(`${base}/logs/plant/${encodeURIComponent('RenamedPlant')}/rename`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: '' }),
  });
  check('rename empty name -> 400', r.status === 400);

  /* ---------------------- Feeding CRUD + mark-fed ---------------------- */

  // schedule id=1 ("Tomato XL") still exists from earlier in the run.
  r = await fetch(`${base}/feeding/1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frequency: 'weekly', nutrient_type: 'Updated Nutrient' }),
  });
  let schedUpdated = await j(r);
  check('PUT /feeding/1 updates', r.status === 200 && schedUpdated.frequency === 'weekly' && schedUpdated.nutrient_type === 'Updated Nutrient');

  r = await fetch(`${base}/feeding/1`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frequency: 'hourly' }),
  });
  check('PUT /feeding invalid frequency -> 400', r.status === 400);

  r = await fetch(`${base}/feeding/999`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frequency: 'weekly' }),
  });
  check('PUT /feeding missing -> 404', r.status === 404);

  r = await fetch(`${base}/feeding/1/fed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  let fedResult = await j(r);
  check('POST /feeding/1/fed sets last_fed', r.status === 200 && !!fedResult.last_fed);

  r = await fetch(`${base}/feeding/999/fed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  check('mark-fed missing -> 404', r.status === 404);

  r = await fetch(`${base}/feeding/1`, { method: 'DELETE' });
  check('DELETE /feeding/1', r.status === 200);
  feeding = await j(await fetch(`${base}/feeding`));
  check('feeding empty after delete', Array.isArray(feeding) && feeding.length === 0);

  r = await fetch(`${base}/feeding/1`, { method: 'DELETE' });
  check('DELETE /feeding missing -> 404', r.status === 404);

  // Feeding validation: missing nutrient_type
  r = await fetch(`${base}/feeding`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plant_name: 'NoNutrient2' }),
  });
  check('POST /feeding missing nutrient_type -> 400', r.status === 400);

  // Persistence
  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  check('data file persisted shape', Array.isArray(raw.logs) && Array.isArray(raw.schedules) && typeof raw.nextId === 'number');

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
