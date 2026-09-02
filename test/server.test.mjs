// Integration tests for the embedded backend (server.js) over real HTTP.
// Converted from test-server.mjs; every test (or tightly coupled flow) gets
// its own server on its own temp dir, so tests are independent.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { freshServer, validLog, PNG_1x1 } from './helpers.mjs';

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

describe('health and empty state', () => {
  it('GET / reports running', async () => {
    const r = await s.get('/');
    expect(r.status).toBe(200);
    expect(r.data.status).toBe('Backend running');
  });
  it('collections start empty and as arrays', async () => {
    expect((await s.get('/logs')).data).toEqual([]);
    expect((await s.get('/feeding')).data).toEqual([]);
    expect((await s.get('/plants')).data).toEqual([]);
  });
  it('creates the data file and uploads dir on startup', () => {
    expect(fs.existsSync(s.dataFile)).toBe(true);
    expect(fs.existsSync(s.uploadsDir)).toBe(true);
  });
  it('unknown routes return 404', async () => {
    expect((await s.get('/nope')).status).toBe(404);
  });
});

describe('logs: create', () => {
  it('POST /logs creates with defaults', async () => {
    const r = await s.post('/logs', validLog());
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ id: 1, height: 12.5, notes: '', image_url: null, plant_name: 'Tomato', plant_id: 1 });
  });
  it('POST /logs by name auto-creates the plant once', async () => {
    await s.post('/logs', validLog());
    await s.post('/logs', validLog({ height: 13 }));
    expect((await s.get('/plants')).data).toHaveLength(1);
  });
  it('POST /logs validation returns 400 with a details array of every failure', async () => {
    const r = await s.post('/logs', { plant_name: '', date: 'not-a-date', height: 9999 });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('Validation failed');
    expect(r.data.details.length).toBeGreaterThanOrEqual(3);
  });
  it('POST /logs with an unknown plant_id -> 404', async () => {
    const r = await s.post('/logs', validLog({ plant_name: undefined, plant_id: 77 }));
    expect(r.status).toBe(404);
  });
  it('POST /logs with plant_id stores rich measurements and denormalizes the name', async () => {
    const p = (await s.post('/plants', { name: 'Cherry' })).data;
    const r = await s.post('/logs', { plant_id: p.id, date: '2026-06-26', height: 30, nutrients: 'GH', ph: 6.1, ec: 1.8, ppm: 900, water_temp: 19, humidity: 65, growth_stage: 'vegetative' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ plant_id: p.id, plant_name: 'Cherry', ph: 6.1, ec: 1.8, ppm: 900, water_temp: 19, humidity: 65, growth_stage: 'vegetative' });
  });
  it('POST /logs multipart with an image stores the file (renamed, magic-byte extension) and sets image_url', async () => {
    const fd = new FormData();
    fd.append('plant_name', 'Tomato'); fd.append('date', '2026-06-26'); fd.append('height', '5'); fd.append('nutrients', 'GH');
    fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'leaf.png');
    const r = await s.post('/logs', fd);
    expect(r.status).toBe(201);
    // Renamed to a random name with the extension the actual bytes justify;
    // the original filename never reaches the stored URL (MR-7).
    expect(r.data.image_url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    expect(fs.existsSync(path.join(s.uploadsDir, path.basename(r.data.image_url)))).toBe(true);
    const img = await s.raw('GET', r.data.image_url);
    expect(img.status).toBe(200);
  });
  it('POST /logs rejects a non-image mimetype with 400 JSON', async () => {
    const fd = new FormData();
    fd.append('plant_name', 'Tomato'); fd.append('date', '2026-06-26'); fd.append('height', '5'); fd.append('nutrients', 'GH');
    fd.append('image', new Blob(['hello'], { type: 'text/plain' }), 'x.txt');
    const r = await s.post('/logs', fd);
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/Invalid file type/);
  });
});

describe('logs: list, update, delete', () => {
  it('GET /logs returns newest-first and filters by plant_id', async () => {
    await s.post('/logs', validLog());
    await new Promise((res) => setTimeout(res, 5));
    const second = (await s.post('/logs', validLog({ plant_name: 'Basil', height: 5 }))).data;
    const all = (await s.get('/logs')).data;
    expect(all.map((l) => l.id)).toEqual([2, 1]);
    const filtered = (await s.get(`/logs?plant_id=${second.plant_id}`)).data;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(second.id);
  });
  it('PUT /logs/:id updates without requiring a date and stamps updated_at', async () => {
    await s.post('/logs', validLog());
    const r = await s.put('/logs/1', { plant_name: 'Tomato XL', height: 20, nutrients: 'FloraGro+', notes: 'grew fast' });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ plant_name: 'Tomato XL', height: 20, notes: 'grew fast', date: '2026-06-26' });
    expect(r.data.updated_at).toBeTruthy();
  });
  it('PUT /logs/:id validation 400, missing 404, unknown plant_id 404', async () => {
    await s.post('/logs', validLog());
    expect((await s.put('/logs/1', { plant_name: '', height: 20, nutrients: 'x' })).status).toBe(400);
    expect((await s.put('/logs/999', { plant_name: 'X', height: 1, nutrients: 'y' })).status).toBe(404);
    expect((await s.put('/logs/1', { plant_id: 55, height: 1, nutrients: 'y' })).status).toBe(404);
  });
  it('DELETE /logs/:id removes one log; missing -> 404', async () => {
    await s.post('/logs', validLog());
    await s.post('/logs', validLog({ height: 2 }));
    const r = await s.del('/logs/2');
    expect(r.status).toBe(200);
    expect(r.data.deletedLog.id).toBe(2);
    expect((await s.get('/logs')).data.map((l) => l.id)).toEqual([1]);
    expect((await s.del('/logs/2')).status).toBe(404);
  });
  it('DELETE /logs/plant/:name is removed (MR-9): 404s and changes nothing', async () => {
    await s.post('/logs', validLog({ plant_name: 'Tomato' }));
    const r = await s.del(`/logs/plant/${encodeURIComponent('Tomato')}`);
    expect(r.status).toBe(404);
    expect((await s.get('/logs')).data).toHaveLength(1);
  });
});

describe('logs: CSV export', () => {
  it('exports text/csv as an attachment with measurement columns and rows', async () => {
    await s.post('/logs', validLog({ plant_name: 'Tomato XL', ph: 6.2 }));
    await s.post('/logs', validLog({ plant_name: 'Basil' }));
    const r = await s.raw('GET', '/logs/export');
    expect(r.headers.get('content-type')).toContain('text/csv');
    expect(r.headers.get('content-disposition')).toContain('attachment');
    const csv = await r.text();
    expect(csv).toContain('plant_name');
    expect(csv).toContain('"ph"');
    expect(csv).toContain('Tomato XL');
    expect(csv).toContain('Basil');
  });
});

describe('plants', () => {
  it('POST /plants creates with metadata; duplicate active name -> 409; validation 400', async () => {
    const r = await s.post('/plants', { name: 'Cherry', variety: 'Sungold', species: 'tomato', reservoir_volume: 50 });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ name: 'Cherry', variety: 'Sungold', species: 'tomato', reservoir_volume: 50, archived: false });
    expect((await s.post('/plants', { name: 'Cherry' })).status).toBe(409);
    expect((await s.post('/plants', { name: '' })).status).toBe(400);
  });
  it('GET /plants/:id returns the plant or 404', async () => {
    const p = (await s.post('/plants', { name: 'Cherry' })).data;
    expect((await s.get(`/plants/${p.id}`)).data.name).toBe('Cherry');
    expect((await s.get('/plants/999')).status).toBe(404);
  });
  it('PUT /plants/:id renames and cascades to logs; clash -> 409; missing -> 404', async () => {
    const p = (await s.post('/plants', { name: 'Cherry' })).data;
    await s.post('/plants', { name: 'Taken' });
    await s.post('/logs', { plant_id: p.id, date: '2026-06-26', height: 1, nutrients: 'x' });
    const r = await s.put(`/plants/${p.id}`, { name: 'Cherry Bomb' });
    expect(r.status).toBe(200);
    expect(r.data.name).toBe('Cherry Bomb');
    expect((await s.get(`/logs?plant_id=${p.id}`)).data[0].plant_name).toBe('Cherry Bomb');
    expect((await s.put(`/plants/${p.id}`, { name: 'Taken' })).status).toBe(409);
    expect((await s.put('/plants/999', { name: 'Ghost' })).status).toBe(404);
  });
  it('archive hides the plant from the default list, keeps its logs, and ?archived=true shows it', async () => {
    const p = (await s.post('/plants', { name: 'Cherry' })).data;
    await s.post('/logs', { plant_id: p.id, date: '2026-06-26', height: 1, nutrients: 'x' });
    expect((await s.post(`/plants/${p.id}/archive`)).status).toBe(200);
    expect((await s.get('/plants')).data.some((x) => x.id === p.id)).toBe(false);
    expect((await s.get('/plants?archived=true')).data.some((x) => x.id === p.id)).toBe(true);
    expect((await s.get(`/logs?plant_id=${p.id}`)).data).toHaveLength(1);
    expect((await s.post('/plants/999/archive')).status).toBe(404);
  });
  it('DELETE /plants/:id cascades logs and schedules; missing -> 404', async () => {
    const p = (await s.post('/plants', { name: 'Cherry' })).data;
    await s.post('/logs', { plant_id: p.id, date: '2026-06-26', height: 1, nutrients: 'x' });
    await s.post('/feeding', { plant_id: p.id, nutrient_type: 'GH' });
    const r = await s.del(`/plants/${p.id}`);
    expect(r.status).toBe(200);
    expect(r.data.deletedLogs).toBe(1);
    expect((await s.get(`/logs?plant_id=${p.id}`)).data).toHaveLength(0);
    expect((await s.get('/feeding')).data).toHaveLength(0);
    expect((await s.del(`/plants/${p.id}`)).status).toBe(404);
  });
});

describe('feeding schedules', () => {
  it('POST /feeding creates; validation 400; unknown plant 404', async () => {
    await s.post('/logs', validLog({ plant_name: 'Tomato XL' }));
    const r = await s.post('/feeding', { plant_name: 'Tomato XL', nutrient_type: 'General Hydroponics', ec_level: '1.2', frequency: 'daily' });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ id: 1, last_fed: null, plant_name: 'Tomato XL', frequency: 'daily' });
    expect((await s.get('/feeding')).data).toHaveLength(1);
    expect((await s.post('/feeding', { plant_name: 'NoNutrient' })).status).toBe(400);
    expect((await s.post('/feeding', { plant_id: 99, nutrient_type: 'GH' })).status).toBe(404);
  });
  it('PUT edits, POST fed stamps last_fed, DELETE removes, then 404s', async () => {
    const sch = (await s.post('/feeding', { plant_name: 'Basil', nutrient_type: 'GH', ec_level: '1.0', frequency: 'weekly' })).data;
    const e = await s.put(`/feeding/${sch.id}`, { plant_name: 'Basil', nutrient_type: 'Masterblend', ec_level: '1.4', frequency: 'daily' });
    expect(e.status).toBe(200);
    expect(e.data).toMatchObject({ nutrient_type: 'Masterblend', frequency: 'daily' });
    expect((await s.put(`/feeding/${sch.id}`, { frequency: 'hourly' })).status).toBe(400);
    const fed = await s.post(`/feeding/${sch.id}/fed`);
    expect(fed.status).toBe(200);
    expect(fed.data.last_fed).toBeTruthy();
    expect((await s.del(`/feeding/${sch.id}`)).status).toBe(200);
    expect((await s.post(`/feeding/${sch.id}/fed`)).status).toBe(404);
    expect((await s.put(`/feeding/${sch.id}`, { notes: 'x' })).status).toBe(404);
    expect((await s.del(`/feeding/${sch.id}`)).status).toBe(404);
  });
});

describe('settings', () => {
  it('GET defaults to metric and PUT clamps enums', async () => {
    const d = (await s.get('/settings')).data;
    expect(d.units.length).toBe('cm');
    expect(d.ppm_scale).toBe(500);
    const r = await s.put('/settings', { units: { length: 'in', temp: 'F', volume: 'bogus' }, ppm_scale: 999 });
    expect(r.data.units).toEqual({ length: 'in', volume: 'liters', temp: 'F' });
    expect(r.data.ppm_scale).toBe(500);
    expect(s.readFile().settings.units.length).toBe('in');
  });
});

describe('persistence', () => {
  it('the data file has the v2 shape after writes', async () => {
    await s.post('/logs', validLog());
    const raw = s.readFile();
    expect(Array.isArray(raw.logs) && Array.isArray(raw.schedules) && Array.isArray(raw.plants)).toBe(true);
    expect(typeof raw.nextId).toBe('number');
    expect(raw.schemaVersion).toBe(2);
  });
});

describe('backup and restore', () => {
  it('GET /backup is a JSON attachment in the envelope shape holding the live data', async () => {
    await s.post('/plants', { name: 'BackupBasil' });
    await s.post('/logs', validLog({ plant_name: 'BackupBasil', height: 8 }));
    const r = await s.raw('GET', '/backup');
    expect(r.headers.get('content-type')).toContain('application/json');
    expect(r.headers.get('content-disposition')).toContain('attachment');
    const b = await r.json();
    expect(b._type).toBe('hydro-growth-tracker-backup');
    expect(b.data.plants).toHaveLength(1);
    expect(b.data.logs).toHaveLength(1);
  });
  it('restore rejects junk, accepts an empty store, round-trips a snapshot and rebuilds ids', async () => {
    await s.post('/plants', { name: 'BackupBasil' });
    await s.post('/logs', validLog({ plant_name: 'BackupBasil', height: 8 }));
    const backup = (await s.get('/backup')).data;
    expect((await s.post('/backup/restore', { hello: 'world' })).status).toBe(400);
    const wipe = await s.post('/backup/restore', { _type: 'hydro-growth-tracker-backup', data: { schemaVersion: 2, plants: [], logs: [], schedules: [] } });
    expect(wipe.status).toBe(200);
    expect((await s.get('/logs')).data).toHaveLength(0);
    const back = await s.post('/backup/restore', backup);
    expect(back.status).toBe(200);
    expect(back.data.counts).toEqual({ plants: 1, logs: 1, schedules: 0 });
    expect((await s.get('/logs')).data).toHaveLength(1);
    const maxId = backup.data.logs.reduce((m, l) => Math.max(m, l.id), 0);
    const next = await s.post('/logs', validLog({ height: 20 }));
    expect(next.status).toBe(201);
    expect(next.data.id).toBeGreaterThan(maxId);
  });
  it('restore upgrades a bare v1 dump into first-class plants', async () => {
    const r = await s.post('/backup/restore', { logs: [{ id: 1, plant_name: 'LegacyBush', date: '2026-01-01', height: 5 }], nextId: 2 });
    expect(r.status).toBe(200);
    expect((await s.get('/plants')).data.some((p) => p.name === 'LegacyBush')).toBe(true);
  });
});

describe('startup against an old-shape file', () => {
  it('serves an array for /feeding when the file has no schedules', async () => {
    const old = await freshServer({ seed: { logs: [], nextId: 1 } });
    try {
      expect((await old.get('/feeding')).data).toEqual([]);
      expect(old.readFile().schemaVersion).toBe(2);
      expect(old.listDir().some((f) => f.startsWith('hydro-data.backup.'))).toBe(true);
    } finally {
      await old.close();
    }
  });
});
