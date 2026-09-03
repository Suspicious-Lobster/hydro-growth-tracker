// Launch the real packaged-mode app (main.js loading frontend/dist over
// file://, backend on a random loopback port with a per-launch token) against
// a fresh temp user-data folder, and hand back the first window.

import { _electron as electron, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

// `seed`: optional string/object written as hydro-data.json before launch.
export async function launchApp({ seed } = {}) {
  const dist = path.join(ROOT, 'frontend', 'dist', 'index.html');
  if (!fs.existsSync(dist)) {
    // A gate aborts rather than testing the wrong thing (CODING-PRACTICES 1.7).
    throw new Error(`frontend/dist/index.html is missing; run "npm run build:frontend" first (${dist})`);
  }
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-e2e-'));
  const dataFile = path.join(userData, 'hydro-data.json');
  if (seed !== undefined) {
    fs.writeFileSync(dataFile, typeof seed === 'string' ? seed : JSON.stringify(seed));
  }
  const app = await electron.launch({
    args: ['.'],
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'test', HYDRO_USER_DATA: userData, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
  });
  const page = await app.firstWindow();
  // Quiet the mascot: the welcome tour and ambient effects are per-device
  // preferences kept in localStorage. Set them and reload so the first paint
  // is the plain app.
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.setItem('bud.tourDone', 'true');
    localStorage.setItem('bud.effectsEnabled', 'false');
    localStorage.setItem('bud.muted', 'true');
    localStorage.setItem('bud.soundEnabled', 'false');
    // Bud floats over the page in a fixed layer and can sit on top of list
    // buttons; minimised, he is a small chip out of the way.
    localStorage.setItem('bud.minimized', 'true');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hydro Growth Tracker' })).toBeVisible();

  const close = async () => {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  };
  return {
    app, page, userData, dataFile,
    uploadsDir: path.join(userData, 'uploads'),
    backupsDir: path.join(userData, 'backups'),
    readStore: () => JSON.parse(fs.readFileSync(dataFile, 'utf8')),
    close,
  };
}

// Click a top tab by its label.
export async function goTo(page, tabLabel) {
  await page.getByRole('button', { name: tabLabel, exact: true }).click();
}

// Plants tab -> Add Plant -> name -> save. Returns after the toast.
export async function createPlant(page, name) {
  await goTo(page, 'Plants');
  await page.getByRole('button', { name: 'Add Plant' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('e.g., Tomato Plant #1').fill(name);
  await dialog.getByRole('button', { name: 'Add Plant' }).click();
  await expect(page.getByText(`Added "${name}"`)).toBeVisible();
}

// Add Log tab -> pick the plant -> height + nutrients (+ optional image path).
export async function addLog(page, { plantName, height, nutrients = 'FloraGro', imagePath = null, ph = null }) {
  await goTo(page, 'Add Log');
  await page.getByRole('button', { name: 'Existing' }).click();
  await page.locator('form select').first().selectOption({ label: plantName });
  await page.locator('input[name="height"]').fill(String(height));
  await page.locator('input[name="nutrients"]').fill(nutrients);
  if (ph !== null) await page.locator('input[name="ph"]').fill(String(ph));
  if (imagePath) await page.locator('input[name="image"]').setInputFiles(imagePath);
  await page.getByRole('button', { name: 'Add Growth Log' }).click();
  await expect(page.getByText('Growth log added')).toBeVisible();
}

// Trigger a download and return the saved file's path. Electron routes
// downloads through the main process (session 'will-download'), not through a
// page event Playwright can see, so the save path is set there.
export async function download(app, trigger, saveAs) {
  const done = app.evaluate(({ session }, target) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no download started within 20s')), 20_000);
    session.defaultSession.once('will-download', (_event, item) => {
      item.setSavePath(target);
      item.once('done', (_e, state) => { clearTimeout(timer); resolve(state); });
    });
  }), saveAs);
  await trigger();
  const state = await done;
  if (state !== 'completed') throw new Error(`download ended in state ${state}`);
  return saveAs;
}

// The dashboard card for a plant: a button that carries the 'Height' stat
// label (the sidebar also renders the plant as a button, without it).
export function dashboardCard(page, name) {
  return page.getByRole('button').filter({ hasText: name }).filter({ has: page.getByText('Height', { exact: true }) });
}

// A toast (role=status) whose text matches.
export const toast = (page, text) => page.getByRole('status').filter({ hasText: text });

export const tmpFile = (name) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hydro-e2e-file-')), name);
