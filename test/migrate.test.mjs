// Tests for the v1 -> v2 data-file migration (db/migrate.js). Converted from
// test-migrate.mjs.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrateData, runMigration } from '../db/migrate.js';
import { SCHEMA_VERSION } from '../db/repository.js';

const v1 = () => ({
  logs: [
    { id: 1, plant_name: 'Tomato', date: '2026-01-01', height: 0, nutrients: 'Initial setup', notes: 'Plant added to tracking system', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 2, plant_name: 'Tomato', date: '2026-01-05', height: 12, nutrients: 'FloraGro', notes: 'growing', created_at: '2026-01-05T00:00:00.000Z' },
    { id: 3, plant_name: 'Basil', date: '2026-01-03', height: 4, nutrients: 'FloraMicro', notes: '', created_at: '2026-01-03T00:00:00.000Z' },
    { id: 4, plant_name: 'Lonely', date: '2026-01-02', height: 0, nutrients: 'Initial setup', notes: 'Plant added to tracking system', created_at: '2026-01-02T00:00:00.000Z' },
  ],
  schedules: [
    { id: 1, plant_name: 'Tomato', nutrient_type: 'GH', ec_level: '1.2', frequency: 'daily', notes: '', last_fed: null, created_at: '2026-01-05T00:00:00.000Z' },
    { id: 1, plant_name: 'GhostPlant', nutrient_type: 'GH', ec_level: '1.0', frequency: 'weekly', notes: '', last_fed: null, created_at: '2026-01-05T00:00:00.000Z' },
  ],
  nextId: 5,
  nextScheduleId: 2,
});

describe('migrateData (pure transform)', () => {
  const { data, changed } = migrateData(v1());

  it('runs and bumps the schema version', () => {
    expect(changed).toBe(true);
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('derives plants from distinct names across logs AND schedules', () => {
    expect(data.plants.map((p) => p.name).sort()).toEqual(['Basil', 'GhostPlant', 'Lonely', 'Tomato']);
    expect(data.nextPlantId).toBe(5);
  });
  it('plant created_at is the earliest known timestamp', () => {
    expect(data.plants.find((p) => p.name === 'Tomato').created_at).toBe('2026-01-01T00:00:00.000Z');
  });
  it('strips sentinel logs and keeps the real ones, linked and backfilled', () => {
    expect(data.logs).toHaveLength(2);
    expect(data.logs.some((l) => l.nutrients === 'Initial setup')).toBe(false);
    const tomato = data.plants.find((p) => p.name === 'Tomato');
    const log = data.logs.find((l) => l.plant_name === 'Tomato');
    expect(log.plant_id).toBe(tomato.id);
    expect(log.height_unit).toBe('cm');
    expect(log.temp_unit).toBe('C');
    expect(log.ph).toBeNull();
    expect(log.ec).toBeNull();
  });
  it('a sentinel-only plant survives with the sentinel date as start_date and no logs', () => {
    const lonely = data.plants.find((p) => p.name === 'Lonely');
    expect(lonely).toBeTruthy();
    expect(lonely.start_date).toBe('2026-01-02');
    expect(data.logs.some((l) => l.plant_id === lonely.id)).toBe(false);
  });
  it('links schedules; a schedule-only name materializes its own plant', () => {
    const tomato = data.plants.find((p) => p.name === 'Tomato');
    const ghost = data.plants.find((p) => p.name === 'GhostPlant');
    const tSched = data.schedules.find((s) => s.plant_name === 'Tomato');
    const gSched = data.schedules.find((s) => s.plant_name === 'GhostPlant');
    expect(tSched.plant_id).toBe(tomato.id);
    expect(tSched.active).toBe(true);
    expect(gSched.plant_id).toBe(ghost.id);
    expect(data.logs.some((l) => l.plant_id === ghost.id)).toBe(false);
  });
  it('seeds metric settings and preserves counters', () => {
    expect(data.settings.units.length).toBe('cm');
    expect(data.settings.ppm_scale).toBe(500);
    expect(data.nextId).toBe(5);
    expect(data.nextScheduleId).toBe(2);
  });
  it('is idempotent on a v2 input', () => {
    expect(migrateData(data).changed).toBe(false);
  });
  it('migrates the legacy {logs, nextId} shape with no schedules', () => {
    const legacy = migrateData({ logs: [{ id: 1, plant_name: 'X', height: 5, nutrients: 'n', notes: '', created_at: '2026-01-01T00:00:00.000Z' }], nextId: 2 });
    expect(legacy.data.plants).toHaveLength(1);
    expect(Array.isArray(legacy.data.schedules)).toBe(true);
  });
  it('does not mutate the caller input', () => {
    const input = v1();
    const snapshot = JSON.stringify(input);
    migrateData(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('runMigration (on disk)', () => {
  it('backs up, migrates atomically, and no-ops on a second run', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-migrate-'));
    const dataFile = path.join(tmp, 'hydro-data.json');
    fs.writeFileSync(dataFile, JSON.stringify(v1()));
    try {
      const result = runMigration(dataFile);
      expect(result.migrated).toBe(true);
      expect(fs.existsSync(result.backupPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(result.backupPath, 'utf8')).schemaVersion).toBeUndefined();
      const onDisk = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      expect(onDisk.schemaVersion).toBe(SCHEMA_VERSION);
      expect(onDisk.plants).toHaveLength(4);
      expect(fs.existsSync(`${dataFile}.tmp`)).toBe(false);
      expect(runMigration(dataFile).migrated).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
  it('returns migrated:false for a missing or unreadable file without writing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-migrate-'));
    const dataFile = path.join(tmp, 'hydro-data.json');
    try {
      expect(runMigration(dataFile).migrated).toBe(false);
      fs.writeFileSync(dataFile, '{ not json');
      expect(runMigration(dataFile).migrated).toBe(false);
      expect(fs.readFileSync(dataFile, 'utf8')).toBe('{ not json');
      expect(fs.readdirSync(tmp)).toEqual(['hydro-data.json']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
