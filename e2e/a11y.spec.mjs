// MR-28: accessibility floor. Every tab must produce zero serious/critical
// axe-core findings: icon-only buttons need a name, dialogs must be announced,
// and so on. One launch per tab, seeded with a plant and a log so Dashboard,
// View Logs and Feeding show real content rather than empty states.
//
// axe is injected straight into the app page and run there. AxeBuilder from
// @axe-core/playwright opens a blank helper page for its final pass, and an
// Electron browser context cannot create pages (Target.createTarget is not
// supported), so it cannot be used here. page.evaluate bypasses the page's
// CSP, which is what lets the injection work against the production build.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import { createRequire } from 'module';
import { launchApp, goTo, createPlant, addLog } from './helpers.mjs';

const require = createRequire(import.meta.url);
const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const TABS = ['Dashboard', 'Add Log', 'View Logs', 'Feeding', 'Plants', 'Settings'];

async function seriousViolations(page) {
  await page.evaluate(AXE_SOURCE);
  const results = await page.evaluate(async () => window.axe.run(document, { resultTypes: ['violations'] }));
  return results.violations
    .filter((v) => ['serious', 'critical'].includes(v.impact))
    .map((v) => `${v.id} [${v.impact}]: ${v.nodes[0] ? v.nodes[0].html : '(no node)'}`);
}

let ctx;
test.afterEach(async () => { if (ctx) { await ctx.close(); ctx = null; } });

for (const tab of TABS) {
  test(`${tab} tab: no serious or critical axe violations`, async () => {
    ctx = await launchApp();
    const { page } = ctx;
    await createPlant(page, 'Axe Test Plant');
    await addLog(page, { plantName: 'Axe Test Plant', height: 12, ph: 6.2 });
    await goTo(page, tab);
    const serious = await seriousViolations(page);
    // Prints the offending element with the id, so a red run names its evidence.
    expect(serious, `axe violations on ${tab}`).toEqual([]);
  });
}
