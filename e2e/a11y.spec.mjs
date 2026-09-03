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

// MR-75: run every tab under both colour schemes explicitly rather than
// inheriting whatever the OS happens to be set to. One scheme per machine
// means half the palette is never checked (CI runs light, most dev machines
// run dark), so a class-string bug in only one scheme can slip through.
for (const theme of ['light', 'dark']) {
  for (const tab of TABS) {
    test(`${tab} tab (${theme}): no serious or critical axe violations`, async () => {
      ctx = await launchApp({ theme });
      const { page } = ctx;
      // Assert the precondition: the reload actually landed on the scheme we
      // asked for, so a spec cannot pass while silently testing the wrong
      // one (CODING-PRACTICES 1.3). ThemeContext toggles the 'dark' class on
      // <html> exactly when isDark, driven by localStorage 'theme'.
      const isDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isDarkClass, `expected 'dark' class on <html> to be ${theme === 'dark'} for theme=${theme}`).toBe(theme === 'dark');
      await createPlant(page, 'Axe Test Plant');
      await addLog(page, { plantName: 'Axe Test Plant', height: 12, ph: 6.2 });
      await goTo(page, tab);
      // click() resolves once the DOM event dispatches, not once React commits
      // the re-render, and the active tab button also carries
      // `transition-all duration-200`: reading axe too early catches it
      // either pre-render (still transparent) or mid CSS transition
      // (partial alpha on its way to the solid fill), both of which read as
      // a false color-contrast violation. bg-light-primary-bg and
      // bg-dark-primary-bg are both #2563eb (App.jsx / tailwind.config.js),
      // so the settled colour is the same rgb() in either theme; wait for it.
      const activeTabButton = page.getByRole('button', { name: tab, exact: true });
      await expect(activeTabButton).toHaveCSS('background-color', 'rgb(37, 99, 235)');
      const serious = await seriousViolations(page);
      // Prints the offending element with the id, so a red run names its evidence.
      expect(serious, `axe violations on ${tab} (${theme})`).toEqual([]);
    });
  }
}
