// MR-1: a data file that EXISTS but cannot be parsed must never be replaced by
// an empty store. Probe P3 (2026-09-02) showed one plant becoming zero plants
// after a settings change; these tests pin the refusal, the untouched bytes,
// the single salvage copy, and the fresh-install branch on the other side.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { freshServer, validLog } from './helpers.mjs';
import * as repo from '../db/repository.js';

const TRUNCATED = '{"schemaVersion":2,"plants":[{"id":1,"name":"Precious"}],"logs":[],"schedules":[],"nextId":1,"nextPlantId":2,"nextScheduleId":1';
const salvageCopies = (d) => d.listDir().filter((f) => f.startsWith('hydro-data.corrupt-'));

describe('server on a damaged data file', () => {
  it('refuses writes with 503, leaves the bytes untouched, and salvages exactly one copy', async () => {
    const d = await freshServer({ seed: TRUNCATED });
    try {
      const before = d.readBytes();
      const r = await d.put('/settings', { ppm_scale: 700 });
      expect(r.status).toBe(503);
      expect(r.data.error).toMatch(/damaged/);
      expect(r.data.damaged.dataFile).toBe(d.dataFile);
      expect(d.readBytes().equals(before)).toBe(true);
      expect(d.readBytes().toString()).toBe(TRUNCATED);
      const salvage = salvageCopies(d);
      expect(salvage).toHaveLength(1);
      expect(fs.readFileSync(path.join(d.tmp, salvage[0])).equals(before)).toBe(true);
      expect(r.data.damaged.salvagePath).toBe(path.join(d.tmp, salvage[0]));
    } finally {
      await d.close();
    }
  });

  it('reports damaged on GET /, refuses reads, creates and restores, and does not spam salvage copies', async () => {
    const d = await freshServer({ seed: TRUNCATED });
    try {
      const health = await d.get('/');
      expect(health.data.status).toBe('damaged');
      expect(health.data.damaged.salvagePath).toContain('hydro-data.corrupt-');
      expect((await d.get('/plants')).status).toBe(503);
      expect((await d.post('/plants', { name: 'Nope' })).status).toBe(503);
      expect((await d.post('/logs', validLog())).status).toBe(503);
      const empty = { _type: 'hydro-growth-tracker-backup', data: { schemaVersion: 2, plants: [], logs: [], schedules: [] } };
      expect((await d.post('/backup/restore', empty)).status).toBe(503);
      expect(salvageCopies(d)).toHaveLength(1);
      expect(d.readBytes().toString()).toBe(TRUNCATED);
    } finally {
      await d.close();
    }
  });

  it('a MISSING file is a fresh install: empty store, status running (the other branch of the guard)', async () => {
    const d = await freshServer();
    try {
      const health = await d.get('/');
      expect(health.data.status).toBe('Backend running');
      expect(health.data.damaged).toBeNull();
      expect(d.readFile().plants).toEqual([]);
      expect((await d.post('/plants', { name: 'First' })).status).toBe(201);
      expect(salvageCopies(d)).toHaveLength(0);
    } finally {
      await d.close();
    }
  });
});

describe('repo.load: missing vs damaged', () => {
  const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-repo-'));

  it('a missing file yields an empty store and writes nothing', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    expect(repo.load(file)).toEqual(repo.emptyData());
    expect(fs.readdirSync(dir)).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('an unparseable file throws DamagedDataFileError and salvages the bytes once', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    const bad = '{"plants":[{"id":1}';
    fs.writeFileSync(file, bad);
    let err;
    try { repo.load(file); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(repo.DamagedDataFileError);
    expect(err.dataFile).toBe(file);
    expect(fs.readFileSync(err.salvagePath, 'utf8')).toBe(bad);
    let err2;
    try { repo.load(file); } catch (e) { err2 = e; }
    expect(err2.salvagePath).toBe(err.salvagePath);
    expect(fs.readdirSync(dir).filter((f) => f.includes('.corrupt-'))).toHaveLength(1);
    expect(fs.readFileSync(file, 'utf8')).toBe(bad);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
