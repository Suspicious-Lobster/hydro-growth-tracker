// MR-8: CSV export neutralises formula-injection cells and writes a UTF-8 BOM
// so Excel doesn't evaluate a hostile cell or garble non-ASCII notes.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { csvSafe } from '../server.js';
import { freshServer, validLog } from './helpers.mjs';

describe('csvSafe (unit)', () => {
  it('prefixes a leading = with a single quote (formula cell)', () => {
    expect(csvSafe('=HYPERLINK("http://evil","click")')).toBe("'=HYPERLINK(\"http://evil\",\"click\")");
  });
  it('prefixes a leading - (e.g. a negative-looking value read as a formula by some locales)', () => {
    expect(csvSafe('-5')).toBe("'-5");
  });
  it('prefixes a leading +', () => {
    expect(csvSafe('+5')).toBe("'+5");
  });
  it('prefixes a leading @', () => {
    expect(csvSafe('@cmd')).toBe("'@cmd");
  });
  it('leaves a plain string untouched', () => {
    expect(csvSafe('FloraGro')).toBe('FloraGro');
  });
  it('leaves non-string values untouched', () => {
    expect(csvSafe(5)).toBe(5);
    expect(csvSafe(null)).toBe(null);
  });
});

let s;
beforeEach(async () => { s = await freshServer(); });
afterEach(async () => { await s.close(); });

describe('GET /logs/export', () => {
  it('neutralises a formula cell and a leading-minus cell in the exported CSV', async () => {
    await s.post('/logs', validLog({ nutrients: '=HYPERLINK("http://evil","click")' }));
    await s.post('/logs', validLog({ nutrients: '-5', plant_name: 'Basil' }));
    await s.post('/logs', validLog({ nutrients: 'FloraGro', plant_name: 'Basil2' }));
    const r = await s.raw('GET', '/logs/export');
    const csv = await r.text();
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'-5");
    // A plain, safe value is not touched.
    expect(csv).toMatch(/(?<!')FloraGro/);
  });

  it('the response body begins with the UTF-8 BOM', async () => {
    await s.post('/logs', validLog());
    const r = await s.raw('GET', '/logs/export');
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    const text = buf.toString('utf8');
    expect(text.codePointAt(0)).toBe(0xfeff);
  });

  it('a note with an accented character round-trips byte-exact after the BOM', async () => {
    await s.post('/logs', validLog({ notes: 'crème brûlée café' }));
    const r = await s.raw('GET', '/logs/export');
    const buf = Buffer.from(await r.arrayBuffer());
    const text = buf.subarray(3).toString('utf8'); // drop the 3-byte BOM
    expect(text).toContain('crème brûlée café');
  });
});
