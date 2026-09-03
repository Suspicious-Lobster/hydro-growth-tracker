// MR-37: structured nutrient doses on logs, reservoir change/top-off events,
// optional nutrients text, and replacing a photo on an existing log.
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshServer, validLog, PNG_1x1 } from './helpers.mjs';
import { validateDoses, validateReservoirEvent } from '../validation.js';
import { formatDosesCell } from '../server.js';

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

const plant = async (name = 'Tomato') => (await s.post('/plants', { name })).data;

describe('doses on logs', () => {
  it('stores and returns structured doses and flattens them into the CSV', async () => {
    const p = await plant();
    const r = await s.post('/logs', validLog({ plant_id: p.id, doses: [{ name: 'Part A', ml_per_l: 2 }, { name: 'Part B', ml_per_l: '1.5' }] }));
    expect(r.status).toBe(201);
    expect(r.data.doses).toEqual([{ name: 'Part A', ml_per_l: 2 }, { name: 'Part B', ml_per_l: 1.5 }]);
    expect((await s.get('/logs')).data[0].doses).toHaveLength(2);

    const csv = await s.raw('GET', '/logs/export');
    const text = await csv.text();
    const [header, row] = text.replace(/^﻿/, '').split(/\r?\n/);
    expect(header.split(',')).toContain('"doses"');
    expect(row).toContain('Part A 2 ml/L; Part B 1.5 ml/L');
  });

  it('accepts doses as a JSON string (multipart form fields are text)', async () => {
    const p = await plant();
    const fd = new FormData();
    fd.append('plant_id', String(p.id)); fd.append('date', '2026-06-26'); fd.append('height', '5');
    fd.append('doses', JSON.stringify([{ name: 'Bloom', ml_per_l: 3 }]));
    fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'x.png');
    const r = await s.post('/logs', fd);
    expect(r.status).toBe(201);
    expect(r.data.doses).toEqual([{ name: 'Bloom', ml_per_l: 3 }]);
  });

  it('a log with no nutrients text and no doses is valid; height stays required', async () => {
    const p = await plant();
    const r = await s.post('/logs', { plant_id: p.id, date: '2026-06-26', height: 4, ph: 6.0 });
    expect(r.status).toBe(201);
    expect(r.data.nutrients).toBe('');
    expect(r.data.doses).toEqual([]);
    expect((await s.post('/logs', { plant_id: p.id, date: '2026-06-26', ph: 6.0 })).status).toBe(400);
  });

  it('rejects more than 10 doses, a dose over 100 ml/L, and a nameless dose', async () => {
    const p = await plant();
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `N${i}`, ml_per_l: 1 }));
    expect((await s.post('/logs', validLog({ plant_id: p.id, doses: many }))).status).toBe(400);
    const hot = await s.post('/logs', validLog({ plant_id: p.id, doses: [{ name: 'A', ml_per_l: 101 }] }));
    expect(hot.status).toBe(400);
    expect(hot.data.details.join(' ')).toContain('ml/L');
    expect((await s.post('/logs', validLog({ plant_id: p.id, doses: [{ name: '', ml_per_l: 1 }] }))).status).toBe(400);
    // Exactly 10 is fine (the boundary, not just the overflow).
    expect((await s.post('/logs', validLog({ plant_id: p.id, doses: many.slice(0, 10) }))).status).toBe(201);
  });

  it('PUT replaces doses only when the key is sent', async () => {
    const p = await plant();
    const { data: log } = await s.post('/logs', validLog({ plant_id: p.id, doses: [{ name: 'A', ml_per_l: 1 }] }));
    const kept = await s.put(`/logs/${log.id}`, { plant_id: p.id, height: 9 });
    expect(kept.data.doses).toEqual([{ name: 'A', ml_per_l: 1 }]);
    const cleared = await s.put(`/logs/${log.id}`, { plant_id: p.id, height: 9, doses: [] });
    expect(cleared.data.doses).toEqual([]);
  });

  it('validateDoses and formatDosesCell at their edges', () => {
    expect(validateDoses(undefined)).toBeNull();
    expect(validateDoses('')).toBeNull();
    expect(validateDoses('not json')).toMatch(/JSON/);
    expect(validateDoses({ name: 'x' })).toMatch(/list/);
    expect(validateDoses([{ name: 'x'.repeat(61), ml_per_l: 1 }])).toMatch(/name/);
    expect(validateDoses([{ name: 'ok', ml_per_l: 'abc' }])).toMatch(/ml\/L/);
    expect(validateDoses([null])).toMatch(/object/);
    expect(formatDosesCell(null)).toBe('');
    expect(formatDosesCell([{ name: 'A', ml_per_l: 2 }])).toBe('A 2 ml/L');
  });
});

describe('reservoir events', () => {
  it('creates, lists newest-first per plant, updates and deletes', async () => {
    const p = await plant();
    const q = await plant('Basil');
    const a = await s.post('/reservoir', { plant_id: p.id, date: '2026-06-01', kind: 'change', volume: 20 });
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ id: 1, plant_id: p.id, plant_name: 'Tomato', kind: 'change', volume: 20, ec: null });
    const b = await s.post('/reservoir', { plant_id: p.id, date: '2026-06-05', kind: 'topoff', volume: '4.5', ec: 1.2, ph: 5.9, notes: 'hot week' });
    expect(b.status).toBe(201);
    await s.post('/reservoir', { plant_id: q.id, date: '2026-06-03', kind: 'change', volume: 10 });

    const mine = (await s.get(`/reservoir?plant_id=${p.id}`)).data;
    expect(mine.map((e) => e.date)).toEqual(['2026-06-05', '2026-06-01']);
    expect((await s.get('/reservoir')).data).toHaveLength(3);

    const upd = await s.put(`/reservoir/${b.data.id}`, { volume: 6, ec: null });
    expect(upd.status).toBe(200);
    expect(upd.data.volume).toBe(6);
    expect(upd.data.ec).toBeNull();
    expect((await s.put('/reservoir/999', { volume: 1 })).status).toBe(404);

    expect((await s.del(`/reservoir/${a.data.id}`)).status).toBe(200);
    expect((await s.get(`/reservoir?plant_id=${p.id}`)).data).toHaveLength(1);
    expect((await s.del('/reservoir/999')).status).toBe(404);
  });

  it('validates the body and refuses an unknown plant', async () => {
    const p = await plant();
    expect((await s.post('/reservoir', { plant_id: p.id, date: '2026-06-01', kind: 'bath', volume: 1 })).status).toBe(400);
    expect((await s.post('/reservoir', { plant_id: p.id, date: 'June 1', kind: 'change', volume: 1 })).status).toBe(400);
    expect((await s.post('/reservoir', { plant_id: p.id, date: '2026-06-01', kind: 'change' })).status).toBe(400);
    expect((await s.post('/reservoir', { plant_id: p.id, date: '2026-06-01', kind: 'change', volume: -1 })).status).toBe(400);
    expect((await s.post('/reservoir', { plant_id: 42, date: '2026-06-01', kind: 'change', volume: 1 })).status).toBe(404);
    expect((await s.put('/reservoir/1', { kind: 'bath' })).status).toBe(400);
    expect(validateReservoirEvent({})).toEqual(expect.arrayContaining(['plant_id is required', 'Date is required', 'Volume is required']));
    expect(validateReservoirEvent({ plant_id: 'x', date: '2026-06-01', kind: 'change', volume: 1, notes: 'n'.repeat(501), ec: 9, ph: 15 }))
      .toEqual(expect.arrayContaining(['plant_id must be a number', 'Notes must be less than 500 characters']));
    expect(validateReservoirEvent({ volume: 'abc' }, { partial: true })).toEqual(['Volume must be a number']);
  });

  it('deleting a plant removes its events, renaming cascades the name', async () => {
    const p = await plant();
    const q = await plant('Basil');
    await s.post('/reservoir', { plant_id: p.id, date: '2026-06-01', kind: 'change', volume: 20 });
    await s.post('/reservoir', { plant_id: q.id, date: '2026-06-01', kind: 'change', volume: 5 });
    await s.put(`/plants/${p.id}`, { name: 'Tomato XL' });
    expect((await s.get(`/reservoir?plant_id=${p.id}`)).data[0].plant_name).toBe('Tomato XL');
    await s.del(`/plants/${p.id}`);
    const left = (await s.get('/reservoir')).data;
    expect(left).toHaveLength(1);
    expect(left[0].plant_id).toBe(q.id);
    // Persisted, not just in memory.
    expect(s.readFile().reservoir_events).toHaveLength(1);
  });

  it('survives backup and restore with ids that keep counting', async () => {
    const p = await plant();
    await s.post('/reservoir', { plant_id: p.id, date: '2026-06-01', kind: 'change', volume: 20 });
    await s.post('/reservoir', { plant_id: p.id, date: '2026-06-02', kind: 'topoff', volume: 2 });
    const backup = (await s.get('/backup')).data;
    expect(backup.data.reservoir_events).toHaveLength(2);
    // Restore a backup whose counter is stale (older app never wrote it).
    delete backup.data.nextReservoirEventId;
    expect((await s.post('/backup/restore', backup)).status).toBe(200);
    expect((await s.get('/reservoir')).data).toHaveLength(2);
    const next = await s.post('/reservoir', { plant_id: p.id, date: '2026-06-03', kind: 'topoff', volume: 1 });
    expect(next.data.id).toBe(3);
  });

  it('a pre-MR-37 data file loads with empty events and an old backup restores', async () => {
    const old = await freshServer({ seed: { schemaVersion: 2, plants: [{ id: 1, name: 'T', archived: false }], logs: [], schedules: [], nextId: 1, nextPlantId: 2, nextScheduleId: 1 } });
    try {
      expect((await old.get('/reservoir')).data).toEqual([]);
      const r = await old.post('/reservoir', { plant_id: 1, date: '2026-06-01', kind: 'change', volume: 1 });
      expect(r.status).toBe(201);
      expect(r.data.id).toBe(1);
    } finally { await old.close(); }
  });
});

describe('replacing a photo on edit', () => {
  const upload = async (plantId, name = 'a.png') => {
    const fd = new FormData();
    fd.append('plant_id', String(plantId)); fd.append('date', '2026-06-26'); fd.append('height', '5');
    fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), name);
    return (await s.post('/logs', fd)).data;
  };

  it('PUT with a new image replaces the URL and removes the old file', async () => {
    const p = await plant();
    const log = await upload(p.id);
    const oldFile = path.join(s.uploadsDir, path.basename(log.image_url));
    expect(fs.existsSync(oldFile)).toBe(true);

    const fd = new FormData();
    fd.append('plant_id', String(p.id)); fd.append('height', '7');
    fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'b.png');
    const r = await s.raw('PUT', `/logs/${log.id}`, fd);
    expect(r.status).toBe(200);
    const updated = await r.json();
    expect(updated.image_url).not.toBe(log.image_url);
    expect(updated.height).toBe(7);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(path.join(s.uploadsDir, path.basename(updated.image_url)))).toBe(true);
    expect(s.listDir(s.uploadsDir)).toHaveLength(1);
  });

  it('a JSON PUT keeps the existing image, and a bad image or bad body leaves it untouched', async () => {
    const p = await plant();
    const log = await upload(p.id);
    const kept = await s.put(`/logs/${log.id}`, { plant_id: p.id, height: 8 });
    expect(kept.data.image_url).toBe(log.image_url);

    const fd = new FormData();
    fd.append('plant_id', String(p.id)); fd.append('height', '9');
    fd.append('image', new Blob([Buffer.from('<html>')], { type: 'image/png' }), 'evil.png');
    expect((await s.raw('PUT', `/logs/${log.id}`, fd)).status).toBe(400);

    const bad = new FormData();
    bad.append('plant_id', String(p.id)); bad.append('height', '-1');
    bad.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'c.png');
    expect((await s.raw('PUT', `/logs/${log.id}`, bad)).status).toBe(400);

    const missing = new FormData();
    missing.append('plant_id', String(p.id)); missing.append('height', '1');
    missing.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'd.png');
    expect((await s.raw('PUT', '/logs/999', missing)).status).toBe(404);

    expect((await s.get('/logs')).data[0].image_url).toBe(log.image_url);
    // Only the original file remains: every rejected upload was cleaned up.
    expect(s.listDir(s.uploadsDir)).toEqual([path.basename(log.image_url)]);
  });
});
