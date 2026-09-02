// MR-2: a data file or backup from a NEWER schema is refused, never "migrated"
// as if it were v1. Probe P4 (2026-09-02): a v3 file lost every new field and a
// v3 backup restored with 200.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrateData, runMigration, SchemaTooNewError, isTooNew } from '../db/migrate.js';
import { SCHEMA_VERSION } from '../db/repository.js';
import { freshServer } from './helpers.mjs';

const v3 = () => ({
  schemaVersion: SCHEMA_VERSION + 1,
  plants: [{ id: 1, name: 'Future', new_field: 'keep me' }],
  logs: [{ id: 1, plant_id: 1, plant_name: 'Future', date: '2026-01-01', height: 3, dosing: [{ ml: 5 }] }],
  schedules: [],
  settings: { units: { length: 'cm', volume: 'liters', temp: 'C' }, ppm_scale: 500, default_species: null, brand_new: true },
  nextId: 2, nextPlantId: 2, nextScheduleId: 1,
});

describe('migrateData refuses a newer schema', () => {
  it('throws SchemaTooNewError naming both versions and leaves the input untouched', () => {
    const input = v3();
    const snapshot = JSON.stringify(input);
    let err;
    try { migrateData(input); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(SchemaTooNewError);
    expect(err.found).toBe(SCHEMA_VERSION + 1);
    expect(err.supported).toBe(SCHEMA_VERSION);
    expect(err.message).toContain(`v${SCHEMA_VERSION + 1}`);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
  it('isTooNew is false for v1 (no version), the current version, and junk', () => {
    expect(isTooNew({ logs: [] })).toBe(false);
    expect(isTooNew({ schemaVersion: SCHEMA_VERSION })).toBe(false);
    expect(isTooNew(null)).toBe(false);
    expect(isTooNew({ schemaVersion: 'later' })).toBe(false);
    expect(isTooNew({ schemaVersion: SCHEMA_VERSION + 1 })).toBe(true);
  });
});

describe('runMigration on a newer file', () => {
  it('returns tooNew, writes nothing, and leaves the bytes byte-identical', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-toonew-'));
    const dataFile = path.join(tmp, 'hydro-data.json');
    const bytes = JSON.stringify(v3(), null, 2);
    fs.writeFileSync(dataFile, bytes);
    try {
      const r = runMigration(dataFile);
      expect(r).toMatchObject({ migrated: false, tooNew: true, found: SCHEMA_VERSION + 1 });
      expect(fs.readFileSync(dataFile, 'utf8')).toBe(bytes);
      expect(fs.readdirSync(tmp)).toEqual(['hydro-data.json']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('server started on a newer file', () => {
  it('reports damaged/tooNew, refuses reads and writes, keeps the file intact, makes no salvage copy', async () => {
    const seed = JSON.stringify(v3());
    const s = await freshServer({ seed });
    try {
      const health = await s.get('/');
      expect(health.data.status).toBe('damaged');
      expect(health.data.damaged.tooNew).toBe(true);
      expect(health.data.damaged.salvagePath).toBeNull();
      expect(health.data.damaged.error).toMatch(/newer version/);
      expect((await s.get('/plants')).status).toBe(503);
      const w = await s.put('/settings', { ppm_scale: 700 });
      expect(w.status).toBe(503);
      expect(w.data.error).toMatch(/newer version/);
      expect(s.readBytes().toString()).toBe(seed);
      expect(s.listDir()).toEqual(['hydro-data.json', 'uploads']);
    } finally {
      await s.close();
    }
  });
});

describe('restore of a newer backup', () => {
  it('returns 400 with a clear message and leaves the store unchanged', async () => {
    const s = await freshServer();
    try {
      await s.post('/plants', { name: 'Mine' });
      const before = (await s.get('/plants')).data;
      const r = await s.post('/backup/restore', { _type: 'hydro-growth-tracker-backup', data: v3() });
      expect(r.status).toBe(400);
      expect(r.data.error).toMatch(/newer version/);
      expect((await s.get('/plants')).data).toEqual(before);
      // A bare (envelope-less) newer dump is refused the same way.
      expect((await s.post('/backup/restore', v3())).status).toBe(400);
      expect(s.listDir().filter((f) => f.includes('pre-restore'))).toEqual([]);
    } finally {
      await s.close();
    }
  });
});
