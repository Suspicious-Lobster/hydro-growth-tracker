// MR-3: write safety. Probe P5 (2026-09-02): a restore replaced the store with
// no snapshot; save() had no fsync and no retry on the Windows rename lock.

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as repo from '../db/repository.js';
import { freshServer, validLog } from './helpers.mjs';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-ws-'));
const files = (dir, prefix) => fs.readdirSync(dir).filter((f) => f.startsWith(prefix)).sort();

afterEach(() => vi.restoreAllMocks());

describe('pre-restore snapshot', () => {
  it('a restore first copies the current store to hydro-data.pre-restore-<ts>.json, byte-equal', async () => {
    const s = await freshServer();
    try {
      await s.post('/plants', { name: 'Before' });
      const before = s.readBytes();
      const r = await s.post('/backup/restore', { _type: 'hydro-growth-tracker-backup', data: { schemaVersion: 2, plants: [], logs: [], schedules: [] } });
      expect(r.status).toBe(200);
      const snaps = files(s.tmp, 'hydro-data.pre-restore-');
      expect(snaps).toHaveLength(1);
      expect(fs.readFileSync(path.join(s.tmp, snaps[0])).equals(before)).toBe(true);
      expect(r.data.previousStoreSavedAs).toBe(path.join(s.tmp, snaps[0]));
      expect((await s.get('/plants')).data).toEqual([]);
    } finally {
      await s.close();
    }
  });

  it('keeps only the newest five pre-restore snapshots', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    fs.writeFileSync(file, '{"v":0}');
    const written = [];
    for (let i = 0; i < 7; i += 1) {
      fs.writeFileSync(file, `{"v":${i}}`);
      written.push(repo.snapshot(file, 'pre-restore', 5));
      // Distinct millisecond timestamps in the filenames.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3);
    }
    const kept = files(dir, 'hydro-data.pre-restore-');
    expect(kept).toHaveLength(5);
    expect(kept.map((f) => path.join(dir, f))).toEqual(written.slice(2));
    expect(fs.readFileSync(path.join(dir, kept[4]), 'utf8')).toBe('{"v":6}');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('save(): last-good copy, fsync, rename retry', () => {
  it('after two saves, .bak holds the first save and no .tmp remains', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    const first = repo.emptyData();
    repo.createPlant(first, { name: 'First' });
    repo.save(file, first);
    const firstBytes = fs.readFileSync(file);
    expect(fs.existsSync(`${file}.bak`)).toBe(false); // nothing to keep yet
    const second = repo.emptyData();
    repo.createPlant(second, { name: 'Second' });
    repo.save(file, second);
    expect(fs.readFileSync(`${file}.bak`).equals(firstBytes)).toBe(true);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).plants[0].name).toBe('Second');
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('fsyncs the temp file before renaming it', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    const fsync = vi.spyOn(fs, 'fsyncSync');
    repo.save(file, repo.emptyData());
    expect(fsync).toHaveBeenCalledTimes(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('retries a transient EPERM on rename and then succeeds', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    const real = fs.renameSync;
    let calls = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      calls += 1;
      if (calls === 1) { const e = new Error('locked'); e.code = 'EPERM'; throw e; }
      return real(from, to);
    });
    const data = repo.emptyData();
    repo.createPlant(data, { name: 'Survives' });
    repo.save(file, data);
    expect(calls).toBe(2);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).plants[0].name).toBe('Survives');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('gives up after the retry budget on a persistent lock, and rethrows a non-transient error at once', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    let calls = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { calls += 1; const e = new Error('locked'); e.code = 'EBUSY'; throw e; });
    expect(() => repo.save(file, repo.emptyData())).toThrow(/locked/);
    expect(calls).toBe(repo.RENAME_RETRIES);
    calls = 0;
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { calls += 1; const e = new Error('gone'); e.code = 'ENOENT'; throw e; });
    expect(() => repo.save(file, repo.emptyData())).toThrow(/gone/);
    expect(calls).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('daily backups', () => {
  it('the server writes one dated copy per local day into backups/ and does not repeat it on later saves', async () => {
    const s = await freshServer();
    try {
      const backupsDir = path.join(s.tmp, 'backups');
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(fs.readdirSync(backupsDir)).toEqual([`hydro-data-${today}.json`]);
      await s.post('/plants', { name: 'A' });
      await s.post('/logs', validLog());
      expect(fs.readdirSync(backupsDir)).toEqual([`hydro-data-${today}.json`]);
    } finally {
      await s.close();
    }
  });

  it('the SERVER keeps only the newest 14 dated copies (the production call, with its default cap)', async () => {
    // Stage 20 old dated copies where the server will look, then start it:
    // its startup backup must prune down to 14 including today's.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-test-'));
    const backups = path.join(tmp, 'backups');
    fs.mkdirSync(backups);
    for (let d = 1; d <= 20; d += 1) {
      fs.writeFileSync(path.join(backups, `hydro-data-2000-01-${String(d).padStart(2, '0')}.json`), '{}');
    }
    fs.writeFileSync(path.join(tmp, 'hydro-data.json'), JSON.stringify(repo.emptyData()));
    const { createServer } = await import('../server.js');
    createServer({ dataFile: path.join(tmp, 'hydro-data.json'), uploadsDir: path.join(tmp, 'uploads') });
    const kept = fs.readdirSync(backups).sort();
    expect(kept).toHaveLength(14);
    expect(kept[0]).toBe('hydro-data-2000-01-08.json');
    expect(kept[13].startsWith('hydro-data-20')).toBe(true); // today's copy is the newest
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('dailyBackup is a no-op for a day that already has a copy', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro-data.json');
    const backups = path.join(dir, 'backups');
    repo.save(file, repo.emptyData());
    const written = repo.dailyBackup(file, backups, undefined, new Date(2026, 1, 1));
    expect(path.basename(written)).toBe('hydro-data-2026-02-01.json');
    expect(repo.dailyBackup(file, backups, undefined, new Date(2026, 1, 1))).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
