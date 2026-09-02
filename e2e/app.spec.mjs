// MR-19: the real app, end to end. Every assertion is on rendered text, a file
// on disk, or the live backend reached through the renderer's own bridge,
// never on a request payload the test built itself.

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { launchApp, goTo, createPlant, addLog, download, tmpFile, PNG_1x1, ROOT, dashboardCard, toast } from './helpers.mjs';

let ctx;
test.afterEach(async () => { if (ctx) { await ctx.close(); ctx = null; } });

test('first run: empty dashboard, product title, no data written yet beyond the empty store', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await expect(page).toHaveTitle('Hydro Growth Tracker');
  await expect(page.getByRole('heading', { name: 'No Plants Yet' })).toBeVisible();
  expect(ctx.readStore().plants).toEqual([]);
  expect(fs.existsSync(ctx.backupsDir)).toBe(true); // today's daily copy
});

test('the renderer reaches the backend only through the per-launch token', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  const result = await page.evaluate(async () => {
    const { apiBase, token } = window.hydro;
    const noToken = await fetch(`${apiBase}/plants`);
    const withToken = await fetch(`${apiBase}/plants`, { headers: { 'X-Hydro-Token': token } });
    return { apiBase, noToken: noToken.status, withToken: withToken.status, tokenLength: token.length };
  });
  expect(result.apiBase).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(result.apiBase.endsWith(':5000')).toBe(false);
  expect(result.noToken).toBe(401);
  expect(result.withToken).toBe(200);
  expect(result.tokenLength).toBe(64);
});

test('create a plant, log a measurement with a photo, see both on the dashboard and in the log list', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Tomato');
  const png = tmpFile('leaf.png');
  fs.writeFileSync(png, PNG_1x1);
  await addLog(page, { plantName: 'Tomato', height: 12.5, imagePath: png, ph: 6.1 });

  await goTo(page, 'Dashboard');
  const card = dashboardCard(page, 'Tomato');
  await expect(card).toContainText('12.5 cm');
  await expect(card).toContainText('pH 6.1');

  await goTo(page, 'View Logs');
  await expect(page.getByText('Total logs: 1')).toBeVisible();
  const img = page.locator('img[alt="Tomato growth"]');
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect(src).toMatch(/\/uploads\/[a-f0-9]+\.png$/);
  const stored = fs.readdirSync(ctx.uploadsDir);
  expect(stored).toHaveLength(1);
  expect(stored[0].endsWith('.png')).toBe(true);
  // The image actually loaded (natural size > 0), so CSP img-src and the static route agree.
  expect(await img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
});

test('edit a log and see the new height rendered', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Basil');
  await addLog(page, { plantName: 'Basil', height: 5 });
  await goTo(page, 'View Logs');
  await page.getByTitle('Edit').first().click();
  const heightInput = page.locator('input[type="number"]').first();
  await heightInput.fill('20');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Log updated')).toBeVisible();
  await expect(page.getByText('20 cm').first()).toBeVisible();
  expect(ctx.readStore().logs[0].height).toBe(20);
});

test('export CSV writes a real file with the logged plant', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Kale');
  await addLog(page, { plantName: 'Kale', height: 7, nutrients: 'Masterblend' });
  const saved = await download(ctx.app, () => page.getByRole('button', { name: 'Export CSV' }).click(), tmpFile('logs.csv'));
  const csv = fs.readFileSync(saved, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('plant_name');
  expect(csv).toContain('Kale');
  expect(csv).toContain('Masterblend');
});

test('backup, delete everything, restore, and the plant comes back', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Pepper');
  await addLog(page, { plantName: 'Pepper', height: 9 });

  await goTo(page, 'Settings');
  const backup = await download(ctx.app, () => page.getByRole('button', { name: 'Download backup' }).click(), tmpFile('backup.json'));
  expect(JSON.parse(fs.readFileSync(backup, 'utf8')).data.plants).toHaveLength(1);

  await goTo(page, 'Plants');
  await page.getByTitle('Delete').first().click();
  await page.getByRole('button', { name: 'Delete Permanently' }).click();
  await expect(page.getByText('Deleted "Pepper"')).toBeVisible();
  await goTo(page, 'Dashboard');
  await expect(page.getByRole('heading', { name: 'No Plants Yet' })).toBeVisible();

  await goTo(page, 'Settings');
  await page.locator('input[type="file"][accept*="json"]').setInputFiles(backup);
  await expect(page.getByText('The backup contains 1 plants, 1 logs')).toBeVisible();
  await page.getByRole('button', { name: 'Replace all data' }).click();
  await expect(page.getByText('Restored 1 plants, 1 logs, 0 schedules')).toBeVisible();
  await goTo(page, 'Dashboard');
  await expect(dashboardCard(page, 'Pepper')).toContainText('9 cm');
  // The pre-restore snapshot exists beside the store.
  expect(fs.readdirSync(ctx.userData).some((f) => f.startsWith('hydro-data.pre-restore-'))).toBe(true);
});

test('archive hides a plant, restore brings it back', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Mint');
  await page.getByTitle('Archive').first().click();
  await expect(page.getByText('Archived "Mint"')).toBeVisible();
  await expect(page.getByText('Current Plants (0)')).toBeVisible();
  await page.getByRole('button', { name: 'Show archived' }).click();
  await page.getByTitle('Restore').first().click();
  await expect(page.getByText('Restored "Mint"')).toBeVisible();
  await expect(page.getByText('Current Plants (1)')).toBeVisible();
});

test('switching the length unit to inches re-renders the dashboard height', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Cucumber');
  await addLog(page, { plantName: 'Cucumber', height: 25.4 });
  await goTo(page, 'Settings');
  await page.locator('select').first().selectOption('in');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await goTo(page, 'Dashboard');
  await expect(dashboardCard(page, 'Cucumber')).toContainText('10 in');
});

test('a second launch against the same data folder exits at once and leaves the first window running', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  const { spawn } = await import('child_process');
  const electronBin = (await import('electron')).default; // path to the electron binary
  const second = spawn(electronBin, ['.'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'test', HYDRO_USER_DATA: ctx.userData, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
    stdio: 'ignore',
  });
  const exitCode = await new Promise((resolve, reject) => {
    const t = setTimeout(() => { second.kill(); reject(new Error('second instance did not exit within 15s')); }, 15_000);
    second.on('exit', (code) => { clearTimeout(t); resolve(code); });
  });
  expect(exitCode).toBe(0);
  // The first instance is still alive and serving.
  await expect(page.getByRole('heading', { name: 'Hydro Growth Tracker' })).toBeVisible();
  const windows = ctx.app.windows();
  expect(windows).toHaveLength(1);
  // Exactly one backend wrote the daily copy: still one dated file.
  expect(fs.readdirSync(ctx.backupsDir)).toHaveLength(1);
});

test('a damaged data file shows the banner and refuses to save', async () => {
  ctx = await launchApp({ seed: '{"schemaVersion":2,"plants":[{"id":1,"name":"Precious"}],"logs":[' });
  const { page } = ctx;
  await expect(page.getByTestId('damaged-banner')).toBeVisible();
  await expect(page.getByTestId('damaged-banner')).toContainText('could not be read');
  const salvage = fs.readdirSync(ctx.userData).filter((f) => f.startsWith('hydro-data.corrupt-'));
  expect(salvage).toHaveLength(1);
  // The file itself is untouched.
  expect(fs.readFileSync(ctx.dataFile, 'utf8')).toBe('{"schemaVersion":2,"plants":[{"id":1,"name":"Precious"}],"logs":[');
  await goTo(page, 'Plants');
  await page.getByRole('button', { name: 'Add Plant' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('e.g., Tomato Plant #1').fill('Nope');
  await dialog.getByRole('button', { name: 'Add Plant' }).click();
  await expect(toast(page, /damaged/)).toBeVisible();
  expect(fs.readFileSync(ctx.dataFile, 'utf8')).toBe('{"schemaVersion":2,"plants":[{"id":1,"name":"Precious"}],"logs":[');
});
