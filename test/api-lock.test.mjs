// MR-5: the local API answers only the app. Probe P1 (2026-09-02) showed CORS
// reflecting https://evil.example with credentials and no authentication, so
// any web page on the machine could read or wipe the store.

import { describe, it, expect } from 'vitest';
import { freshServer, validLog } from './helpers.mjs';
import { startServer, DEFAULT_ALLOWED_ORIGINS } from '../server.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TOKEN = 'test-token-0123456789abcdef';
const DATA_ROUTES = ['/plants', '/logs', '/feeding', '/settings', '/backup'];

describe('per-launch token', () => {
  it('every data route is 401 without the token and works with it', async () => {
    const s = await freshServer({ token: TOKEN });
    try {
      for (const route of DATA_ROUTES) {
        const r = await s.get(route, { 'X-Hydro-Token': '' });
        expect(r.status, `GET ${route} without token`).toBe(401);
        expect(r.data.error).toMatch(/Unauthorized/);
      }
      expect((await s.post('/plants', { name: 'X' }, { 'X-Hydro-Token': 'wrong' })).status).toBe(401);
      expect((await s.del('/logs/1', { 'X-Hydro-Token': '' })).status).toBe(401);
      expect((await s.post('/backup/restore', { plants: [] }, { 'X-Hydro-Token': '' })).status).toBe(401);
      // Nothing was written by the rejected calls.
      expect(s.readFile().plants).toEqual([]);
      // With the token (default headers from the helper) everything works.
      expect((await s.get('/plants')).status).toBe(200);
      expect((await s.post('/plants', { name: 'X' })).status).toBe(201);
      expect((await s.post('/logs', validLog())).status).toBe(201);
      expect((await s.get('/settings')).status).toBe(200);
      expect((await s.get('/backup')).status).toBe(200);
    } finally {
      await s.close();
    }
  });

  it('health and uploaded images stay reachable without the token', async () => {
    const s = await freshServer({ token: TOKEN });
    try {
      const health = await s.get('/', { 'X-Hydro-Token': '' });
      expect(health.status).toBe(200);
      expect(health.data.status).toBe('Backend running');
      fs.writeFileSync(path.join(s.uploadsDir, 'x.png'), 'not really a png');
      const img = await s.raw('GET', '/uploads/x.png', undefined, { 'X-Hydro-Token': '' });
      expect(img.status).toBe(200);
    } finally {
      await s.close();
    }
  });

  it('CORS preflight is answered for an allowed origin so the browser can send the token header', async () => {
    const s = await freshServer({ token: TOKEN, allowedOrigins: ['http://localhost:5173'] });
    try {
      const r = await s.raw('OPTIONS', '/plants', undefined, {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-hydro-token,content-type',
        'X-Hydro-Token': '',
      });
      expect(r.status).toBeLessThan(300);
      expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      expect((r.headers.get('access-control-allow-headers') || '').toLowerCase()).toContain('x-hydro-token');
    } finally {
      await s.close();
    }
  });
});

describe('CORS allowlist', () => {
  it('a foreign origin gets no CORS headers at all; an allowed one gets exactly itself, no credentials', async () => {
    const s = await freshServer({ token: TOKEN, allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS, 'http://localhost:5173'] });
    try {
      const evil = await s.raw('GET', '/plants', undefined, { Origin: 'https://evil.example' });
      expect(evil.headers.get('access-control-allow-origin')).toBeNull();
      expect(evil.headers.get('access-control-allow-credentials')).toBeNull();
      const ok = await s.raw('GET', '/plants', undefined, { Origin: 'http://localhost:5173' });
      expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
      expect(ok.headers.get('access-control-allow-credentials')).toBeNull();
      const packaged = await s.raw('GET', '/', undefined, { Origin: 'null' });
      expect(packaged.headers.get('access-control-allow-origin')).toBe('null');
    } finally {
      await s.close();
    }
  });

  it('by default only the packaged renderer origins are allowed', () => {
    expect(DEFAULT_ALLOWED_ORIGINS).toEqual(['null', 'file://']);
  });
});

describe('startServer binds loopback on an OS-chosen port', () => {
  it('two servers get two different ports, both on 127.0.0.1, and report apiBase', async () => {
    const mk = () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-port-'));
      return startServer({ dataFile: path.join(tmp, 'd.json'), uploadsDir: path.join(tmp, 'u'), token: TOKEN });
    };
    const a = await mk();
    const b = await mk();
    try {
      expect(a.port).toBeGreaterThan(0);
      expect(b.port).toBeGreaterThan(0);
      expect(a.port).not.toBe(b.port);
      expect(a.httpServer.address().address).toBe('127.0.0.1');
      expect(a.apiBase).toBe(`http://127.0.0.1:${a.port}`);
      const r = await fetch(`${a.apiBase}/plants`, { headers: { 'X-Hydro-Token': TOKEN } });
      expect(r.status).toBe(200);
    } finally {
      await new Promise((res) => a.httpServer.close(res));
      await new Promise((res) => b.httpServer.close(res));
    }
  });
});
