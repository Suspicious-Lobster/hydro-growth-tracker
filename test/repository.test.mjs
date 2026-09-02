// Unit tests for db/repository.js: the pure entity helpers over an in-memory
// data object, plus load/save/prepareImport against a temp dir.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as repo from '../db/repository.js';

const data = () => repo.emptyData();

describe('normalize / emptyData', () => {
  it('emptyData is the current schema with counters at 1', () => {
    const d = data();
    expect(d.schemaVersion).toBe(repo.SCHEMA_VERSION);
    expect(d).toMatchObject({ plants: [], logs: [], schedules: [], nextId: 1, nextPlantId: 1, nextScheduleId: 1 });
    expect(d.settings).toEqual({ units: { length: 'cm', volume: 'liters', temp: 'C' }, ppm_scale: 500, default_species: null });
  });
  it('normalize fills missing top-level and nested settings fields', () => {
    const d = repo.normalize({ logs: [{ id: 1 }], settings: { units: { temp: 'F' } } });
    expect(d.logs).toHaveLength(1);
    expect(d.schedules).toEqual([]);
    expect(d.settings.units).toEqual({ length: 'cm', volume: 'liters', temp: 'F' });
    expect(d.settings.ppm_scale).toBe(500);
  });
  it('normalize tolerates null', () => {
    expect(repo.normalize(null).plants).toEqual([]);
  });
});

describe('plants', () => {
  it('createPlant assigns sequential ids, trims the name, coerces volume', () => {
    const d = data();
    const a = repo.createPlant(d, { name: '  Tomato ', reservoir_volume: '50' });
    const b = repo.createPlant(d, { name: 'Basil', reservoir_volume: 'lots' });
    expect([a.id, b.id]).toEqual([1, 2]);
    expect(a.name).toBe('Tomato');
    expect(a.reservoir_volume).toBe(50);
    expect(b.reservoir_volume).toBeNull();
    expect(d.nextPlantId).toBe(3);
    expect(a.archived).toBe(false);
  });
  it('listPlants sorts A to Z and hides archived unless asked', () => {
    const d = data();
    repo.createPlant(d, { name: 'Zucchini' });
    const b = repo.createPlant(d, { name: 'basil' });
    repo.createPlant(d, { name: 'Mint' });
    repo.archivePlant(d, b.id);
    expect(repo.listPlants(d).map((p) => p.name)).toEqual(['Mint', 'Zucchini']);
    expect(repo.listPlants(d, { includeArchived: true }).map((p) => p.name)).toEqual(['basil', 'Mint', 'Zucchini']);
  });
  it('getPlant returns null for unknown or NaN ids', () => {
    const d = data();
    repo.createPlant(d, { name: 'A' });
    expect(repo.getPlant(d, 99)).toBeNull();
    expect(repo.getPlant(d, NaN)).toBeNull();
  });
  it('updatePlant renames and cascades the denormalized name to logs and schedules', () => {
    const d = data();
    const p = repo.createPlant(d, { name: 'Old' });
    repo.createLog(d, { plant_id: p.id, date: '2026-01-01', height: 1, nutrients: 'x' });
    repo.createSchedule(d, { plant_id: p.id, nutrient_type: 'GH' });
    repo.updatePlant(d, p.id, { name: 'New', variety: '' });
    expect(d.logs[0].plant_name).toBe('New');
    expect(d.schedules[0].plant_name).toBe('New');
    expect(d.plants[0].variety).toBeNull();
    expect(repo.updatePlant(d, 42, { name: 'x' })).toBeNull();
  });
  it('deletePlantCascade removes the plant, its logs and its schedules', () => {
    const d = data();
    const p = repo.createPlant(d, { name: 'A' });
    const q = repo.createPlant(d, { name: 'B' });
    repo.createLog(d, { plant_id: p.id, date: '2026-01-01', height: 1, nutrients: 'x' });
    repo.createLog(d, { plant_id: q.id, date: '2026-01-01', height: 1, nutrients: 'x' });
    repo.createSchedule(d, { plant_id: p.id, nutrient_type: 'GH' });
    const res = repo.deletePlantCascade(d, p.id);
    expect(res.deletedLogs).toBe(1);
    expect(d.plants.map((x) => x.id)).toEqual([q.id]);
    expect(d.logs).toHaveLength(1);
    expect(d.schedules).toHaveLength(0);
    expect(repo.deletePlantCascade(d, 99)).toBeNull();
  });
});

describe('logs', () => {
  it('createLog by name auto-creates the plant; by id links it; measurements coerce', () => {
    const d = data();
    const l1 = repo.createLog(d, { plant_name: 'Auto', date: '2026-01-01', height: '3.5', nutrients: ' GH ', ph: '6.1', ec: '', ppm: 'n/a', temp_unit: 'F', height_unit: 'in' });
    expect(d.plants).toHaveLength(1);
    expect(l1).toMatchObject({ plant_id: 1, plant_name: 'Auto', height: 3.5, ph: 6.1, ec: null, ppm: null, temp_unit: 'F', height_unit: 'in', nutrients: 'GH', notes: '', image_url: null });
    const l2 = repo.createLog(d, { plant_id: 1, date: '2026-01-02', height: 4, nutrients: 'GH' });
    expect(l2.plant_id).toBe(1);
    expect(d.plants).toHaveLength(1);
    expect(d.nextId).toBe(3);
  });
  it('updateLog touches only the fields sent; explicit null clears; absent keeps', () => {
    const d = data();
    const l = repo.createLog(d, { plant_name: 'A', date: '2026-01-01', height: 1, nutrients: 'x', ph: 6, ec: 1.5, notes: 'keep' });
    repo.updateLog(d, l.id, { ph: null, height: 2 });
    expect(l.ph).toBeNull();
    expect(l.ec).toBe(1.5);
    expect(l.height).toBe(2);
    expect(l.notes).toBe('keep');
    expect(l.date).toBe('2026-01-01');
    expect(l.updated_at).toBeTruthy();
    expect(repo.updateLog(d, 99, {})).toBeNull();
  });
  it('updateLog re-points a log to another plant by id', () => {
    const d = data();
    const a = repo.createPlant(d, { name: 'A' });
    const b = repo.createPlant(d, { name: 'B' });
    const l = repo.createLog(d, { plant_id: a.id, date: '2026-01-01', height: 1, nutrients: 'x' });
    repo.updateLog(d, l.id, { plant_id: b.id });
    expect(l.plant_id).toBe(b.id);
    expect(l.plant_name).toBe('B');
  });
  it('listLogs filters by plant_id', () => {
    const d = data();
    const a = repo.createPlant(d, { name: 'A' });
    const b = repo.createPlant(d, { name: 'B' });
    repo.createLog(d, { plant_id: a.id, date: '2026-01-01', height: 1, nutrients: 'x' });
    repo.createLog(d, { plant_id: b.id, date: '2026-01-01', height: 1, nutrients: 'x' });
    expect(repo.listLogs(d, { plant_id: String(a.id) })).toHaveLength(1);
    expect(repo.listLogs(d)).toHaveLength(2);
  });
  it('deleteLog returns the removed log or null', () => {
    const d = data();
    const l = repo.createLog(d, { plant_name: 'A', date: '2026-01-01', height: 1, nutrients: 'x' });
    expect(repo.deleteLog(d, l.id).id).toBe(l.id);
    expect(d.logs).toHaveLength(0);
    expect(repo.deleteLog(d, l.id)).toBeNull();
  });
});

describe('schedules', () => {
  it('createSchedule defaults and custom interval parsing', () => {
    const d = data();
    const s = repo.createSchedule(d, { plant_name: 'A', nutrient_type: 'GH' });
    expect(s).toMatchObject({ id: 1, plant_id: 1, frequency: 'daily', custom_interval_days: null, active: true, last_fed: null, ec_level: '' });
    const c = repo.createSchedule(d, { plant_id: 1, nutrient_type: 'GH', frequency: 'custom', custom_interval_days: '4' });
    expect(c.custom_interval_days).toBe(4);
  });
  it('updateSchedule, markFed and deleteSchedule', () => {
    const d = data();
    const s = repo.createSchedule(d, { plant_name: 'A', nutrient_type: 'GH' });
    repo.updateSchedule(d, s.id, { frequency: 'weekly', active: 0, custom_interval_days: 'x' });
    expect(s.frequency).toBe('weekly');
    expect(s.active).toBe(false);
    expect(s.custom_interval_days).toBeNull();
    expect(repo.markFed(d, s.id).last_fed).toBeTruthy();
    expect(repo.deleteSchedule(d, s.id).id).toBe(s.id);
    expect(repo.markFed(d, s.id)).toBeNull();
    expect(repo.updateSchedule(d, s.id, {})).toBeNull();
    expect(repo.deleteSchedule(d, s.id)).toBeNull();
  });
});

describe('settings', () => {
  it('updateSettings clamps every enum and clears default_species', () => {
    const d = data();
    const s = repo.updateSettings(d, { units: { length: 'in', volume: 'bogus', temp: 'F' }, ppm_scale: 999, default_species: 'tomato' });
    expect(s.units).toEqual({ length: 'in', volume: 'liters', temp: 'F' });
    expect(s.ppm_scale).toBe(500);
    expect(s.default_species).toBe('tomato');
    repo.updateSettings(d, { ppm_scale: 700, default_species: '' });
    expect(s.ppm_scale).toBe(700);
    expect(s.default_species).toBeNull();
    expect(repo.getSettings(d)).toBe(s);
  });
});

describe('load / save / prepareImport', () => {
  const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-repo-'));

  it('save writes atomically (no .tmp left) and load reads it back normalized', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'd.json');
    const d = data();
    repo.createPlant(d, { name: 'A' });
    repo.save(file, d);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    expect(repo.load(file).plants).toHaveLength(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it('prepareImport forces arrays, rebuilds counters from max ids, stamps the schema', () => {
    const d = repo.prepareImport({ plants: [{ id: 7, name: 'X' }], logs: 'nope', schedules: [{ id: 3 }], nextId: 1 });
    expect(d.logs).toEqual([]);
    expect(d.nextPlantId).toBe(8);
    expect(d.nextScheduleId).toBe(4);
    expect(d.nextId).toBe(1);
    expect(d.schemaVersion).toBe(repo.SCHEMA_VERSION);
    expect(d.settings.units.length).toBe('cm');
  });
  it('prepareImport keeps a larger stored counter', () => {
    const d = repo.prepareImport({ plants: [{ id: 1 }], logs: [], schedules: [], nextPlantId: 50 });
    expect(d.nextPlantId).toBe(50);
  });
});
