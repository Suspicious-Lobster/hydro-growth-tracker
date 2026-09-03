// MR-54: backup with photos. GET /backup/zip bundles backup.json plus every
// referenced upload; POST /backup/restore/zip validates every entry before
// touching the store and refuses traversal, non-image bytes and foreign
// envelopes.
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshServer, validLog, PNG_1x1 } from './helpers.mjs';
import { readZipBackup } from '../server.js';

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

const ENVELOPE = (data) => ({ _type: 'hydro-growth-tracker-backup', _version: 1, exportedAt: 'x', data });
const bareStore = () => ({ schemaVersion: 2, plants: [{ id: 1, name: 'T', archived: false }], logs: [], schedules: [], settings: {}, nextId: 1, nextPlantId: 2, nextScheduleId: 1 });

const withPhoto = async (server) => {
  const p = (await server.post('/plants', { name: 'Tomato' })).data;
  const fd = new FormData();
  fd.append('plant_id', String(p.id)); fd.append('date', '2026-06-26'); fd.append('height', '5');
  fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'a.png');
  const log = (await server.post('/logs', fd)).data;
  await server.post('/logs', validLog({ plant_id: p.id, date: '2026-06-27' }));
  return { plant: p, log };
};

const zipOf = (entries) => {
  const z = new AdmZip();
  for (const [name, bytes] of entries) z.addFile(name, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
  return z.toBuffer();
};

const restoreZip = (server, buffer) => {
  const fd = new FormData();
  fd.append('archive', new Blob([buffer], { type: 'application/zip' }), 'b.zip');
  return server.raw('POST', '/backup/restore/zip', fd);
};

describe('GET /backup/zip', () => {
  it('holds backup.json and the referenced photo bytes', async () => {
    const { log } = await withPhoto(s);
    const r = await s.raw('GET', '/backup/zip');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/zip');
    expect(r.headers.get('content-disposition')).toMatch(/hydro_backup_\d{4}-\d{2}-\d{2}\.zip/);
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(0, 2).toString('ascii')).toBe('PK');
    const zip = new AdmZip(buf);
    const names = zip.getEntries().map((e) => e.entryName).sort();
    const photoName = path.basename(log.image_url);
    expect(names).toEqual(['backup.json', `uploads/${photoName}`]);
    const envelope = JSON.parse(zip.readAsText('backup.json'));
    expect(envelope._type).toBe('hydro-growth-tracker-backup');
    expect(envelope.data.logs).toHaveLength(2);
    expect(zip.readFile(`uploads/${photoName}`).equals(fs.readFileSync(path.join(s.uploadsDir, photoName)))).toBe(true);
  });

  it('skips a referenced photo whose file is missing instead of failing', async () => {
    const { log } = await withPhoto(s);
    fs.unlinkSync(path.join(s.uploadsDir, path.basename(log.image_url)));
    const r = await s.raw('GET', '/backup/zip');
    expect(r.status).toBe(200);
    const zip = new AdmZip(Buffer.from(await r.arrayBuffer()));
    expect(zip.getEntries().map((e) => e.entryName)).toEqual(['backup.json']);
  });
});

describe('POST /backup/restore/zip', () => {
  it('round-trips a zip into a fresh server: same image_url and the file is back', async () => {
    const { log } = await withPhoto(s);
    const buf = Buffer.from(await (await s.raw('GET', '/backup/zip')).arrayBuffer());
    const fresh = await freshServer();
    try {
      const r = await restoreZip(fresh, buf);
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.counts).toMatchObject({ plants: 1, logs: 2, photos: 1 });
      expect(body.previousStoreSavedAs).toMatch(/pre-restore/);
      const logs = (await fresh.get('/logs')).data;
      const restored = logs.find((l) => l.image_url);
      expect(restored.image_url).toBe(log.image_url);
      const file = path.join(fresh.uploadsDir, path.basename(log.image_url));
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file).equals(PNG_1x1)).toBe(true);
      // Served, not just present.
      expect((await fresh.raw('GET', log.image_url)).status).toBe(200);
    } finally { await fresh.close(); }
  });

  it('refuses a traversal entry name and writes nothing', async () => {
    const before = s.readBytes();
    const buf = zipOf([['backup.json', JSON.stringify(ENVELOPE(bareStore()))], ['../evil.png', PNG_1x1]]);
    const r = await restoreZip(s, buf);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/Refusing zip entry/);
    expect(fs.existsSync(path.join(s.tmp, 'evil.png'))).toBe(false);
    expect(fs.existsSync(path.join(s.uploadsDir, 'evil.png'))).toBe(false);
    expect(s.listDir(s.uploadsDir)).toEqual([]);
    expect(s.readBytes().equals(before)).toBe(true);
    // A nested directory entry is refused the same way.
    const nested = zipOf([['backup.json', JSON.stringify(ENVELOPE(bareStore()))], ['uploads/sub/x.png', PNG_1x1]]);
    expect((await restoreZip(s, nested)).status).toBe(400);
  });

  it('refuses non-image bytes under uploads/ and a zip that is not our envelope', async () => {
    const before = s.readBytes();
    const html = zipOf([['backup.json', JSON.stringify(ENVELOPE(bareStore()))], ['uploads/x.png', '<html>']]);
    const r1 = await restoreZip(s, html);
    expect(r1.status).toBe(400);
    expect((await r1.json()).error).toMatch(/not a PNG/);
    const foreign = zipOf([['backup.json', JSON.stringify({ plants: [], logs: [] })]]);
    const r2 = await restoreZip(s, foreign);
    expect(r2.status).toBe(400);
    expect((await r2.json()).error).toMatch(/Hydro backup/);
    const nojson = zipOf([['readme.txt', 'hi']]);
    expect((await restoreZip(s, nojson)).status).toBe(400);
    const notzip = await restoreZip(s, Buffer.from('definitely not a zip'));
    expect(notzip.status).toBe(400);
    expect((await notzip.json()).error).toMatch(/zip/);
    expect((await s.raw('POST', '/backup/restore/zip', new FormData())).status).toBe(400);
    expect(s.readBytes().equals(before)).toBe(true);
    expect(s.listDir(s.uploadsDir)).toEqual([]);
  });

  it('refuses a newer-schema backup inside the zip', async () => {
    const buf = zipOf([['backup.json', JSON.stringify(ENVELOPE({ ...bareStore(), schemaVersion: 99 }))]]);
    const r = await restoreZip(s, buf);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/newer/i);
  });

  it('readZipBackup validates without touching disk', () => {
    const ok = readZipBackup(zipOf([['backup.json', JSON.stringify(ENVELOPE(bareStore()))], ['uploads/a.png', PNG_1x1]]));
    expect(ok.images).toHaveLength(1);
    expect(ok.images[0].name).toBe('a.png');
    expect(() => readZipBackup(zipOf([['backup.json', '{not json']]))).toThrow(/valid JSON/);
    expect(() => readZipBackup(zipOf([['backup.json', JSON.stringify(ENVELOPE(bareStore()))], ['C:/evil.png', PNG_1x1]]))).toThrow(/Refusing/);
  });
});
