// MR-4: a plant name is unique among ACTIVE plants. Probe P2 (2026-09-02): with
// an archived 'Tomato', a log posted by name attached to the archived plant,
// and restoring it produced two active plants called Tomato.

import { describe, it, expect } from 'vitest';
import { freshServer, validLog } from './helpers.mjs';
import * as repo from '../db/repository.js';
import { validatePlant } from '../validation.js';

const activeNamed = async (s, name) => (await s.get('/plants')).data.filter((p) => p.name === name);

describe('name resolution across the archive boundary', () => {
  it('a log or schedule posted by name attaches to the ACTIVE namesake, never the archived one', async () => {
    const s = await freshServer();
    try {
      const old = (await s.post('/plants', { name: 'Tomato' })).data;
      expect((await s.post(`/plants/${old.id}/archive`)).status).toBe(200);
      const fresh = await s.post('/plants', { name: 'Tomato' });
      expect(fresh.status).toBe(201);
      const log = (await s.post('/logs', validLog({ plant_name: 'Tomato' }))).data;
      expect(log.plant_id).toBe(fresh.data.id);
      const sched = (await s.post('/feeding', { plant_name: 'Tomato', nutrient_type: 'GH' })).data;
      expect(sched.plant_id).toBe(fresh.data.id);
      expect((await activeNamed(s, 'Tomato')).map((p) => p.id)).toEqual([fresh.data.id]);
    } finally {
      await s.close();
    }
  });

  it('by name with only an archived namesake, a NEW plant is created rather than reviving the archived one', async () => {
    const s = await freshServer();
    try {
      const old = (await s.post('/plants', { name: 'Basil' })).data;
      await s.post(`/plants/${old.id}/archive`);
      const log = (await s.post('/logs', validLog({ plant_name: 'Basil' }))).data;
      expect(log.plant_id).not.toBe(old.id);
      expect((await s.get(`/plants/${old.id}`)).data.archived).toBe(true);
    } finally {
      await s.close();
    }
  });

  it('repo.findPlantByName prefers the active match and honours activeOnly', () => {
    const d = repo.emptyData();
    const a = repo.createPlant(d, { name: 'X' });
    repo.archivePlant(d, a.id);
    expect(repo.findPlantByName(d, 'X').id).toBe(a.id); // archived fallback when nothing is active
    expect(repo.findPlantByName(d, 'X', { activeOnly: true })).toBeNull();
    const b = repo.createPlant(d, { name: 'X' });
    expect(repo.findPlantByName(d, ' X ').id).toBe(b.id);
    expect(repo.findPlantByName(d, 'X', { activeOnly: true }).id).toBe(b.id);
  });
});

describe('restore', () => {
  it('POST /plants/:id/restore refuses a clash with 409 and keeps exactly one active namesake', async () => {
    const s = await freshServer();
    try {
      const old = (await s.post('/plants', { name: 'Tomato' })).data;
      await s.post(`/plants/${old.id}/archive`);
      await s.post('/plants', { name: 'Tomato' });
      const r = await s.post(`/plants/${old.id}/restore`);
      expect(r.status).toBe(409);
      expect(r.data.error).toMatch(/already named "Tomato"/);
      expect(await activeNamed(s, 'Tomato')).toHaveLength(1);
      expect((await s.get(`/plants/${old.id}`)).data.archived).toBe(true);
    } finally {
      await s.close();
    }
  });

  it('renaming the archived plant first, then restoring, succeeds; restore is idempotent; missing -> 404', async () => {
    const s = await freshServer();
    try {
      const old = (await s.post('/plants', { name: 'Tomato' })).data;
      await s.post(`/plants/${old.id}/archive`);
      await s.post('/plants', { name: 'Tomato' });
      expect((await s.put(`/plants/${old.id}`, { name: 'Tomato (old)' })).status).toBe(200);
      const r = await s.post(`/plants/${old.id}/restore`);
      expect(r.status).toBe(200);
      expect(r.data.archived).toBe(false);
      expect((await s.get('/plants')).data.map((p) => p.name).sort()).toEqual(['Tomato', 'Tomato (old)']);
      expect((await s.post(`/plants/${old.id}/restore`)).status).toBe(200);
      expect((await s.post('/plants/999/restore')).status).toBe(404);
    } finally {
      await s.close();
    }
  });

  it('un-archiving through PUT archived:false is clash-checked the same way', async () => {
    const s = await freshServer();
    try {
      const old = (await s.post('/plants', { name: 'Kale' })).data;
      await s.post(`/plants/${old.id}/archive`);
      await s.post('/plants', { name: 'Kale' });
      expect((await s.put(`/plants/${old.id}`, { archived: false })).status).toBe(409);
      expect(await activeNamed(s, 'Kale')).toHaveLength(1);
    } finally {
      await s.close();
    }
  });
});

describe('partial plant updates', () => {
  it('PUT without a name keeps the name; an empty name is still rejected', async () => {
    const s = await freshServer();
    try {
      const p = (await s.post('/plants', { name: 'Mint', variety: 'Spear' })).data;
      const r = await s.put(`/plants/${p.id}`, { variety: 'Apple' });
      expect(r.status).toBe(200);
      expect(r.data).toMatchObject({ name: 'Mint', variety: 'Apple' });
      expect((await s.put(`/plants/${p.id}`, { name: '' })).status).toBe(400);
      expect((await s.put(`/plants/${p.id}`, { name: '   ' })).status).toBe(400);
    } finally {
      await s.close();
    }
  });

  it('validatePlant: create requires a name, partial does not', () => {
    expect(validatePlant({})).toHaveLength(1);
    expect(validatePlant({}, { partial: true })).toEqual([]);
    expect(validatePlant({ name: '' }, { partial: true })).toHaveLength(1);
    expect(validatePlant({ variety: 'x'.repeat(101) }, { partial: true })).toHaveLength(1);
  });
});
