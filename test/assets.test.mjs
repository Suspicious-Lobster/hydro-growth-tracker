// Guards MR-14: real application icons instead of the 1x1 placeholder PNG.
// Verifies the generated icon.png/.ico/.icns are structurally valid image
// files (not text stand-ins) and that every icon path referenced from
// package.json's build config actually exists on disk.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));

describe('icon.png', () => {
  const pngPath = path.join(root, 'assets', 'icons', 'icon.png');
  const bytes = readFileSync(pngPath);

  it('starts with the PNG magic bytes', () => {
    const magic = [...bytes.slice(0, 8)];
    console.log('icon.png magic bytes:', magic.map((b) => b.toString(16).padStart(2, '0')).join(' '));
    expect(magic).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('is 1024x1024 per its IHDR chunk', () => {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    console.log(`icon.png dimensions: ${width}x${height}`);
    expect(width).toBe(1024);
    expect(height).toBe(1024);
  });
});

describe('icon.ico', () => {
  const icoPath = path.join(root, 'assets', 'icons', 'icon.ico');
  const bytes = readFileSync(icoPath);

  it('exists and has the ICO header', () => {
    console.log('icon.ico header bytes:', [...bytes.slice(0, 4)]);
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0x00);
    expect(bytes[2]).toBe(0x01);
    expect(bytes[3]).toBe(0x00);
  });

  it('is over 10 KB', () => {
    console.log('icon.ico size:', bytes.length, 'bytes');
    expect(bytes.length).toBeGreaterThan(10 * 1024);
  });
});

describe('icon.icns', () => {
  const icnsPath = path.join(root, 'assets', 'icons', 'icon.icns');
  const bytes = readFileSync(icnsPath);

  it('starts with the "icns" magic', () => {
    const magic = bytes.slice(0, 4).toString('ascii');
    console.log('icon.icns magic:', magic);
    expect(magic).toBe('icns');
  });

  it('is over 10 KB', () => {
    console.log('icon.icns size:', bytes.length, 'bytes');
    expect(bytes.length).toBeGreaterThan(10 * 1024);
  });
});

describe('package.json build icon paths', () => {
  const iconRefs = [
    ['build.win.icon', packageJson.build?.win?.icon],
    ['build.mac.icon', packageJson.build?.mac?.icon],
    ['build.linux.icon', packageJson.build?.linux?.icon],
    ['build.dmg.icon', packageJson.build?.dmg?.icon],
  ];

  it.each(iconRefs)('%s (%s) resolves to a real file', (_label, relPath) => {
    expect(typeof relPath).toBe('string');
    const resolved = path.join(root, relPath);
    console.log(`${_label} -> ${resolved} exists=${existsSync(resolved)}`);
    expect(existsSync(resolved)).toBe(true);
  });
});
