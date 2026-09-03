// MR-55: CSV import with a dry-run preview. Our own export round-trips;
// foreign headers are aliased; a bad row is reported by line and blocks the
// write; nothing is written in dry run.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshServer, validLog } from './helpers.mjs';
import { parseCsv, parseLogImport } from '../server.js';

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, CRLF and a BOM', () => {
    const text = '﻿a,b\r\n"x, y","he said ""hi"""\n1,\n';
    expect(parseCsv(text)).toEqual([['a', 'b'], ['x, y', 'he said "hi"'], ['1', '']]);
  });
  it('returns [] for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('POST /logs/import', () => {
  it('round-trips our own export exactly (heights, pH, dates, doses, notes)', async () => {
    const p = (await s.post('/plants', { name: 'Tomato' })).data;
    await s.post('/logs', validLog({ plant_id: p.id, date: '2026-06-01', height: 10.5, ph: 5.9, ec: 1.1, doses: [{ name: 'Part A', ml_per_l: 2 }], notes: 'note, with comma' }));
    await s.post('/logs', validLog({ plant_id: p.id, date: '2026-06-08', height: 14, ph: 6.1, nutrients: '=SUM(1)' }));
    await s.post('/logs', validLog({ plant_id: p.id, date: '2026-06-15', height: 20, humidity: 55, air_temp: 24 }));
    const csv = await (await s.raw('GET', '/logs/export')).text();

    const fresh = await freshServer();
    try {
      const dry = await fresh.post('/logs/import', { csv });
      expect(dry.status).toBe(200);
      expect(dry.data).toMatchObject({ dryRun: true, rows: 3, valid: 3, errors: [], newPlants: ['Tomato'] });
      expect((await fresh.get('/logs')).data).toEqual([]);
      expect((await fresh.get('/plants')).data).toEqual([]);

      const real = await fresh.post('/logs/import', { csv, dryRun: false });
      expect(real.status).toBe(201);
      expect(real.data.created).toEqual({ logs: 3, plants: 1 });
      const logs = (await fresh.get('/logs')).data;
      expect(logs.map((l) => [l.date, l.height, l.ph, l.ec])).toEqual([
        ['2026-06-15', 20, null, null],
        ['2026-06-08', 14, 6.1, null],
        ['2026-06-01', 10.5, 5.9, 1.1],
      ]);
      const first = logs[2];
      expect(first.doses).toEqual([{ name: 'Part A', ml_per_l: 2 }]);
      expect(first.notes).toBe('note, with comma');
      expect(logs[1].nutrients).toBe('=SUM(1)'); // csvSafe prefix stripped back off
      expect(logs[0].humidity).toBe(55);
      expect(logs[0].air_temp).toBe(24);
      expect(logs.every((l) => l.plant_name === 'Tomato')).toBe(true);
      expect(new Set(logs.map((l) => l.plant_id)).size).toBe(1);
    } finally { await fresh.close(); }
  });

  it('reports an invalid row by line number and writes nothing in dry run or commit', async () => {
    const csv = 'plant,date,height,ph\nBasil,2026-06-01,5,6.0\nBasil,2026-06-02,6,15\nBasil,bad-date,7,6.0\n';
    const dry = await s.post('/logs/import', { csv });
    expect(dry.status).toBe(200);
    expect(dry.data.rows).toBe(3);
    expect(dry.data.valid).toBe(1);
    expect(dry.data.errors).toEqual([
      { line: 3, messages: ['pH must be between 0 and 14'] },
      { line: 4, messages: ['Date must be a valid date format'] },
    ]);
    expect((await s.get('/logs')).data).toEqual([]);
    expect((await s.get('/plants')).data).toEqual([]);

    const real = await s.post('/logs/import', { csv, dryRun: false });
    expect(real.status).toBe(400);
    expect(real.data.error).toMatch(/2 invalid row/);
    expect((await s.get('/logs')).data).toEqual([]);
  });

  it('aliases foreign headers, converts inch heights, creates named plants once and reuses an active one', async () => {
    const existing = (await s.post('/plants', { name: 'Kale' })).data;
    await s.post('/plants', { name: 'Old Kale' });
    await s.post(`/plants/${(await s.post('/plants', { name: 'Ghost' })).data.id}/archive`);
    const csv = 'Name,Date,Height,Unit,Stage,Notes\nKale,2026-05-01,10,in,vegetative,hi\nMint,2026-05-01,3,cm,,\nMint,2026-05-02,4,cm,,\nGhost,2026-05-03,2,cm,,\n';
    const dry = await s.post('/logs/import', { csv });
    expect(dry.data).toMatchObject({ valid: 4, newPlants: ['Mint', 'Ghost'] });
    const real = await s.post('/logs/import', { csv, dryRun: false });
    expect(real.status).toBe(201);
    expect(real.data.created).toEqual({ logs: 4, plants: 2 });
    const logs = (await s.get('/logs')).data;
    const kale = logs.find((l) => l.plant_name === 'Kale');
    expect(kale.plant_id).toBe(existing.id);
    expect(kale.height).toBe(25.4);
    expect(kale.growth_stage).toBe('vegetative');
    expect(kale.notes).toBe('hi');
    const mint = (await s.get('/plants')).data.filter((p) => p.name === 'Mint');
    expect(mint).toHaveLength(1);
    // The archived Ghost is never reused: a fresh active plant is created.
    const ghosts = (await s.get('/plants?archived=true')).data.filter((p) => p.name === 'Ghost');
    expect(ghosts).toHaveLength(2);
    expect(logs.find((l) => l.plant_name === 'Ghost').plant_id).toBe(ghosts.find((g) => !g.archived).id);
  });

  it('refuses a missing header, an empty file, a non-string body and an oversized file', async () => {
    expect((await s.post('/logs/import', { csv: 'foo,bar\n1,2\n' })).data.errors[0].messages[0]).toMatch(/plant, date and height/);
    expect((await s.post('/logs/import', { csv: '   ' })).status).toBe(400);
    expect((await s.post('/logs/import', { csv: 42 })).status).toBe(400);
    expect((await s.post('/logs/import', {})).status).toBe(400);
    const big = 'plant,date,height\n' + 'Basil,2026-06-01,5,'.repeat(300000) + '\n';
    expect(Buffer.byteLength(big)).toBeGreaterThan(5 * 1024 * 1024); // precondition: over the cap
    const r = await s.post('/logs/import', { csv: big });
    expect(r.status).toBe(413);
    expect(parseLogImport('').errors[0].messages[0]).toMatch(/empty/);
  });

  it('a clean file with no data rows is not an import', async () => {
    const r = await s.post('/logs/import', { csv: 'plant,date,height\n', dryRun: false });
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/Nothing to import/);
  });
});
