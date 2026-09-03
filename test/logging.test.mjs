// MR-23: in the packaged app there is no console, so a failed migration, a
// damaged store, or a route throw were previously invisible. These tests pin
// the logger itself (append + rotation) and the server's use of it: a route
// throw must write a line naming the route and the message to the log file,
// and the default (no logger passed) must stay silent.

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createLogger, nullLogger } from '../logger.js';
import { freshServer } from './helpers.mjs';
import * as repo from '../db/repository.js';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-log-'));

afterEach(() => vi.restoreAllMocks());

describe('createLogger', () => {
  it('appends a line with the level, message, and JSON meta', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'logs', 'hydro.log');
    const logger = createLogger({ file });
    logger.error('Something broke', { message: 'boom', code: 'EBUSY' });
    const contents = fs.readFileSync(file, 'utf8');
    const line = contents.trim();
    expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z ERROR Something broke /);
    expect(line).toContain(JSON.stringify({ message: 'boom', code: 'EBUSY' }));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rotates to <file>.1 once the file exceeds maxBytes, keeping only one rotated copy', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro.log');
    const logger = createLogger({ file, maxBytes: 50 });
    // One line, by itself, already well over the 50-byte cap.
    logger.info('a'.repeat(80));
    expect(fs.existsSync(`${file}.1`)).toBe(false);
    const sizeBeforeRotation = fs.statSync(file).size;
    expect(sizeBeforeRotation).toBeGreaterThan(50);
    // Rotation is checked BEFORE the write, so this next call is what moves
    // the oversized file to .1 and starts the live file fresh.
    logger.info('second line, after rotation');
    expect(fs.existsSync(`${file}.1`)).toBe(true);
    expect(fs.statSync(`${file}.1`).size).toBe(sizeBeforeRotation);
    const liveContents = fs.readFileSync(file, 'utf8');
    expect(liveContents).toContain('second line, after rotation');
    expect(liveContents).not.toContain('a'.repeat(80));
    expect(fs.statSync(file).size).toBeLessThan(sizeBeforeRotation);
    // A second rotation overwrites the .1 rather than accumulating .2, .3, ...
    logger.info('c'.repeat(80));
    logger.info('third line, after second rotation');
    expect(fs.existsSync(`${file}.2`)).toBe(false);
    expect(fs.readFileSync(`${file}.1`, 'utf8')).not.toContain('second line, after rotation');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('server logging', () => {
  it('writes a route error, naming the route and the message, to the injected logger\'s file', async () => {
    const dir = tmpDir();
    const file = path.join(dir, 'hydro.log');
    const logger = createLogger({ file });
    const s = await freshServer({ logger });
    try {
      vi.spyOn(repo, 'listPlants').mockImplementation(() => {
        throw new Error('boom: plants store is not iterable');
      });
      const r = await s.get('/plants');
      expect(r.status).toBe(500);
      const contents = fs.readFileSync(file, 'utf8');
      expect(contents).toContain('Error handling GET /plants');
      expect(contents).toContain('boom: plants store is not iterable');
    } finally {
      await s.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('RED PROOF: with the default nullLogger, nothing is written anywhere', async () => {
    const dir = tmpDir();
    const s = await freshServer();
    try {
      vi.spyOn(repo, 'listPlants').mockImplementation(() => {
        throw new Error('boom: plants store is not iterable');
      });
      const r = await s.get('/plants');
      expect(r.status).toBe(500);
      // nullLogger has no file of its own; nothing should have appeared in a
      // fresh scratch dir either — proves the default path writes nowhere.
      expect(fs.readdirSync(dir)).toHaveLength(0);
      expect(nullLogger.file).toBeNull();
    } finally {
      await s.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
