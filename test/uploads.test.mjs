// MR-7: uploaded images are sniffed by content, not trusted by mimetype or
// filename, and deleted along with the log/plant that referenced them.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { freshServer, validLog, PNG_1x1 } from './helpers.mjs';

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

describe('uploads: content sniffing', () => {
  it('a file named evil.html sent with mimetype image/png is stored as .png (bytes win over filename)', async () => {
    const fd = new FormData();
    fd.append('plant_name', 'Tomato'); fd.append('date', '2026-06-26'); fd.append('height', '5'); fd.append('nutrients', 'GH');
    fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'evil.html');
    const r = await s.post('/logs', fd);
    expect(r.status).toBe(201);
    expect(r.data.image_url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    expect(r.data.image_url).not.toMatch(/evil/);
  });

  it('a PNG-mimetype upload with HTML bytes -> 400 and nothing left on disk', async () => {
    const before = s.listDir(s.uploadsDir);
    const fd = new FormData();
    fd.append('plant_name', 'Tomato'); fd.append('date', '2026-06-26'); fd.append('height', '5'); fd.append('nutrients', 'GH');
    fd.append('image', new Blob(['<html><body>evil</body></html>'], { type: 'image/png' }), 'evil.png');
    const r = await s.post('/logs', fd);
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('Invalid image file');
    const after = s.listDir(s.uploadsDir);
    expect(after).toEqual(before);
    // The log itself must not have been created either.
    expect((await s.get('/logs')).data).toHaveLength(0);
  });
});

describe('uploads: cleanup on delete', () => {
  it('deleting a log with an image leaves the uploads dir one file smaller', async () => {
    const fd = new FormData();
    fd.append('plant_name', 'Tomato'); fd.append('date', '2026-06-26'); fd.append('height', '5'); fd.append('nutrients', 'GH');
    fd.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'leaf.png');
    const created = (await s.post('/logs', fd)).data;
    const before = s.listDir(s.uploadsDir).length;
    expect(before).toBe(1);
    const del = await s.del(`/logs/${created.id}`);
    expect(del.status).toBe(200);
    const after = s.listDir(s.uploadsDir).length;
    expect(after).toBe(before - 1);
    expect(fs.existsSync(path.join(s.uploadsDir, path.basename(created.image_url)))).toBe(false);
  });

  it('deleting a plant removes every image of its logs', async () => {
    const plant = (await s.post('/plants', { name: 'Cherry' })).data;
    const fd1 = new FormData();
    fd1.append('plant_id', String(plant.id)); fd1.append('date', '2026-06-26'); fd1.append('height', '5'); fd1.append('nutrients', 'GH');
    fd1.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'one.png');
    const fd2 = new FormData();
    fd2.append('plant_id', String(plant.id)); fd2.append('date', '2026-06-27'); fd2.append('height', '6'); fd2.append('nutrients', 'GH');
    fd2.append('image', new Blob([PNG_1x1], { type: 'image/png' }), 'two.png');
    await s.post('/logs', fd1);
    await s.post('/logs', fd2);
    expect(s.listDir(s.uploadsDir)).toHaveLength(2);
    const del = await s.del(`/plants/${plant.id}`);
    expect(del.status).toBe(200);
    expect(s.listDir(s.uploadsDir)).toHaveLength(0);
  });
});
