// MR-58: e2e coverage for the wave-2 features (quick log, reservoir events,
// dosing, zip backup). Same style as app.spec.mjs — every assertion is on
// rendered text or a file on disk, never on state the test built itself.

import { test, expect } from '@playwright/test';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { launchApp, goTo, createPlant, addLog, download, tmpFile, PNG_1x1 } from './helpers.mjs';

let ctx;
test.afterEach(async () => { if (ctx) { await ctx.close(); ctx = null; } });

test('quick-log a pH reading from the dashboard and see it in the log list', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Strawberry');
  await goTo(page, 'Dashboard');

  await page.getByLabel('Quick height').fill('12');
  await page.getByLabel('Quick pH').fill('6.1');
  await page.getByRole('button', { name: 'Quick log' }).click();
  await expect(page.getByText('Logged')).toBeVisible();

  await goTo(page, 'View Logs');
  await expect(page.getByRole('heading', { name: 'Strawberry' })).toBeVisible();
  await expect(page.locator('span').filter({ hasText: 'pH' })).toBeVisible();
  await expect(page.getByText('6.1')).toBeVisible();
});

test('add a reservoir change on the plant view and see the last-change caption', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Lettuce');
  await goTo(page, 'Dashboard');
  // The sidebar lists the plant as a nav button ("Lettuce · N logs"); the
  // dashboard also renders a card with the same name, so scope to the sidebar.
  await page.locator('.w-64').getByRole('button', { name: /Lettuce/ }).click();

  await page.getByLabel('Volume').fill('20');
  await page.getByRole('button', { name: 'Add event' }).click();
  await expect(page.getByText('Reservoir event added')).toBeVisible();
  await expect(page.getByText('Last full change: 0 days ago')).toBeVisible();
});

test('add a log with a dose row and see it rendered in View Logs', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Pepper Plant');
  await goTo(page, 'Add Log');
  await page.getByRole('button', { name: 'Existing' }).click();
  await page.locator('form select').first().selectOption({ label: 'Pepper Plant' });
  await page.locator('input[name="height"]').fill('5');
  await page.getByRole('button', { name: 'Add dose' }).click();
  await page.getByLabel('Dose name').fill('Part A');
  await page.getByLabel('Dose ml/L').fill('2');
  await page.getByRole('button', { name: 'Add Growth Log' }).click();
  await expect(page.getByText('Growth log added')).toBeVisible();

  await goTo(page, 'View Logs');
  await expect(page.getByText('Part A 2 ml/L')).toBeVisible();
});

test('download the zip backup and find backup.json plus the uploaded photo inside', async () => {
  ctx = await launchApp();
  const { page } = ctx;
  await createPlant(page, 'Cucumber Plant');
  const png = tmpFile('leaf.png');
  fs.writeFileSync(png, PNG_1x1);
  await addLog(page, { plantName: 'Cucumber Plant', height: 8, imagePath: png });

  await goTo(page, 'Settings');
  const saved = await download(
    ctx.app,
    () => page.getByRole('button', { name: 'Download backup with photos' }).click(),
    tmpFile('backup.zip'),
  );

  const bytes = fs.readFileSync(saved);
  expect(bytes.subarray(0, 2).toString('ascii')).toBe('PK');
  const zip = new AdmZip(bytes);
  const names = zip.getEntries().map((e) => e.entryName);
  expect(names).toContain('backup.json');
  expect(names.some((n) => n.startsWith('uploads/'))).toBe(true);
});
