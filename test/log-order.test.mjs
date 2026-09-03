// MR-10: GET /logs orders by the user-entered measurement `date`, not the
// server insert time, so a backdated entry doesn't jump to the top.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { freshServer, validLog } from './helpers.mjs';

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

describe('GET /logs ordering', () => {
  it('a log dated 2026-06-10 posted first still lists before one dated 2020-01-01 posted after it', async () => {
    await s.post('/logs', validLog({ date: '2026-06-10' }));
    await s.post('/logs', validLog({ date: '2020-01-01', plant_name: 'Basil' }));
    const logs = (await s.get('/logs')).data;
    expect(logs.map((l) => l.date)).toEqual(['2026-06-10', '2020-01-01']);
  });

  it('two logs on the same date list newest-inserted first', async () => {
    await s.post('/logs', validLog({ date: '2026-06-10', height: 1 }));
    await new Promise((res) => setTimeout(res, 5));
    await s.post('/logs', validLog({ date: '2026-06-10', height: 2 }));
    const logs = (await s.get('/logs')).data;
    expect(logs.map((l) => l.height)).toEqual([2, 1]);
  });

  it('a log with no created_at and a log with no date sort without throwing, identically across two calls', async () => {
    const a = (await s.post('/logs', validLog({ date: '2026-01-01' }))).data;
    const b = (await s.post('/logs', validLog({ date: '2026-02-01', plant_name: 'Basil' }))).data;
    // Damage the stored rows directly: one loses `date`, the other loses
    // `created_at`, exercising the fallback path without an odd API surface.
    const raw = s.readFile();
    const logA = raw.logs.find((l) => l.id === a.id);
    const logB = raw.logs.find((l) => l.id === b.id);
    delete logA.date;
    delete logB.created_at;
    fs.writeFileSync(s.dataFile, JSON.stringify(raw));

    const first = (await s.get('/logs')).data;
    const second = (await s.get('/logs')).data;
    expect(() => first).not.toThrow();
    expect(first.map((l) => l.id)).toEqual(second.map((l) => l.id));
  });
});
