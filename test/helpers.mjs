// Shared test helpers: a fresh embedded backend per test, on its own temp dir
// and an OS-assigned port, torn down after. Nothing here touches the real
// hydro-data.json.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServer } from '../server.js';

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Start a server on a fresh temp dir. Returns helpers bound to its base URL.
// `seed` (optional) is written as the initial data file before startup, so a
// test can stage an old-schema or damaged file.
// `token` / `allowedOrigins` are passed straight to createServer; when a token
// is set, every request from these helpers carries it unless `extraHeaders`
// overrides X-Hydro-Token (set it to '' to test the unauthenticated path).
export async function freshServer({ seed, extraHeaders = {}, token = null, allowedOrigins } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-test-'));
  const dataFile = path.join(tmp, 'hydro-data.json');
  const uploadsDir = path.join(tmp, 'uploads');
  if (seed !== undefined) {
    fs.writeFileSync(dataFile, typeof seed === 'string' ? seed : JSON.stringify(seed));
  }
  if (token) extraHeaders = { 'X-Hydro-Token': token, ...extraHeaders };
  const app = createServer({ dataFile, uploadsDir, token, allowedOrigins });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const request = async (method, p, body, headers = {}) => {
    const init = { method, headers: { ...extraHeaders, ...headers } };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) { init.headers = { ...JSON_HEADERS, ...init.headers }; init.body = JSON.stringify(body); }
    return fetch(base + p, init);
  };
  const json = async (method, p, body, headers) => {
    const r = await request(method, p, body, headers);
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: r.status, headers: r.headers, data };
  };

  return {
    base, tmp, dataFile, uploadsDir, app, server,
    get: (p, h) => json('GET', p, undefined, h),
    post: (p, b, h) => json('POST', p, b, h),
    put: (p, b, h) => json('PUT', p, b, h),
    del: (p, h) => json('DELETE', p, undefined, h),
    raw: request,
    readFile: () => JSON.parse(fs.readFileSync(dataFile, 'utf8')),
    readBytes: () => fs.readFileSync(dataFile),
    listDir: (d = tmp) => fs.readdirSync(d),
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

// Minimal valid 1x1 PNG, for upload tests.
export const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

export const validLog = (over = {}) => ({
  plant_name: 'Tomato', date: '2026-06-26', height: 12.5, nutrients: 'FloraGro', ...over,
});
