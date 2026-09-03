#!/usr/bin/env node
// Bud capture strip (MR-70).
//
// Drives every cue Bud's body (BudThree.jsx) knows how to perform, screenshots
// the mascot canvas at 0/30/60/90% of the cue's nominal duration, and writes
// one contact-sheet PNG per cue plus an index.html. It also prints a table of
// cue name -> pixel diff vs a pre-cue rest frame, which is the number MR-64's
// red proof reads: a reaction cue that never moves is a cue nobody wired up.
//
// Usage:
//   node tools/bud_capture.mjs --out <dir> [--disabled] [--port <n>]
//
// --disabled calls window.__bud.disableCues() before capturing anything. That
// makes cue() a no-op in the rig, so every reaction cue's diff drops sharply
// and the script exits non-zero — this is the row's red proof. See
// tools/README-bud-capture.md for exactly how "drops sharply" plays out
// against the rig's own ambient blink/breathe noise, and why an exact
// literal 0 is not achievable on a live WebGL scene that never fully holds
// still.

import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { CUES } from '../frontend/src/data/budCues.js';
import { createServer } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// --- idle emotes that have NO entry in budCues.js (they are triggered via
// __bud.emote(name), never __bud.cue(name)). Durations lifted from the EMOTE
// table in frontend/src/components/Assistant/BudThree.jsx (line ~45-49):
// wave/stretch/groove/munch are hand-tuned there; smoke is raise+spark+puff.
// lookAround/scratch/hum/watch already exist in CUES and are captured from
// there instead, so they are NOT repeated in this list.
const EXTRA_EMOTES = {
  wave: 2.4,
  smoke: 4.8, // raise 1.0 + spark 1.4 + puff 2.4
  stretch: 2.6,
  groove: 3.4,
  munch: 3.2,
};

// Reaction cues per the row: the ones a user action should visibly provoke.
// These are the only cues whose diff-vs-rest is required to clear the
// pass/fail threshold; the rest (idle life, locomotion settle) are captured
// and reported for visibility but not gated.
const REACTION_CUES = new Set([
  'peek', 'nod', 'wince', 'cheer', 'sulk', 'shrug', 'facepalm', 'point', 'land', 'welcomeBack',
]);

// Contact-sheet frames are exactly the 4 the row asks for. The diff-vs-rest
// metric is measured at a finer grid across the same window, because a short
// cue's peak pose can fall between 60% and 90% and 4 samples undersell it
// (seen in practice: cheer/wince/welcomeBack read close to the noise floor
// at only 4 samples, comfortably clear of it at 8).
const SHEET_PCTS = [0, 0.3, 0.6, 0.9];
const DIFF_PCTS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0];
const CAPTURE_PCTS = [...new Set([...SHEET_PCTS, ...DIFF_PCTS])].sort((a, b) => a - b);
// A reaction cue's 2nd-highest-of-8 diff must beat this multiple of the
// measured rest-vs-rest noise floor. Tuned against several live runs
// (2026-09-03, see tools/README-bud-capture.md for the numbers): one
// consistently-subtle cue (wince, a small fast brow-knit) reliably measures
// only ~2-2.75x the floor even when genuinely firing, so anything higher
// than 2.0 started failing it in an enabled (green) run. 2.0 is the number
// that let every reaction cue clear the bar without being tuned to squeeze
// one run's single smallest number through.
const NOISE_MULTIPLIER = 2.0;

function parseArgs(argv) {
  const args = { out: null, disabled: false, port: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--disabled') args.disabled = true;
    else if (a === '--port') args.port = Number(argv[++i]);
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Kill a process and its whole tree. On Windows a plain child.kill() only
// signals the shell wrapper, leaving node/vite running underneath it.
function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // already gone
  }
}

// Start the seeded backend (createServer from server.js) on a fresh temp
// data dir. This is optional per the row (the mascot renders without a
// backend), but createServer only needs a data-file path that does not have
// to exist yet (db/repository.js treats a missing file as a fresh, empty
// store), so it is cheap to do properly.
async function startBackend() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bud-capture-'));
  const dataFile = path.join(tmpDir, 'hydro-data.json');
  const uploadsDir = path.join(tmpDir, 'uploads');
  const backupsDir = path.join(tmpDir, 'backups');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(backupsDir, { recursive: true });
  const token = 'bud-capture-token';
  const app = createServer({ dataFile, uploadsDir, backupsDir, token, logger: { info() {}, warn() {}, error() {} } });
  const port = await getFreePort();
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(port, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });
  return {
    port,
    token,
    tmpDir,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// Start `npm --prefix frontend run dev -- --port <n> --strictPort` and wait
// for Vite to print its "Local:" line before returning.
function startDevServer(port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['--prefix', 'frontend', 'run', 'dev', '--', '--port', String(port), '--strictPort'],
      { cwd: REPO_ROOT, env: { ...process.env, ...env }, shell: process.platform === 'win32' },
    );
    let out = '';
    let settled = false;
    const onData = (buf) => {
      out += buf.toString();
      // Vite colors its "Local:" line with ANSI escapes wedged between the
      // word and the colon (e.g. "Local\x1b[22m:"), so strip escapes first.
      const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
      if (!settled && /Local:/.test(plain)) {
        settled = true;
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`vite dev server exited early (code ${code}):\n${out}`));
      }
    });
    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`vite dev server did not print "Local:" within 30s:\n${out}`));
      }
    }, 30_000);
  });
}

// Raw RGBA bytes + dimensions for a canvas screenshot buffer.
async function toRaw(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

// Sum of absolute per-channel differences between two same-sized raw buffers.
function channelSumDiff(a, b) {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

async function captureCanvas(page) {
  const png = await page.locator('canvas').first().screenshot();
  return { png, raw: await toRaw(png) };
}

async function buildContactSheet(frames, outPath) {
  const width = frames[0].raw.width;
  const height = frames[0].raw.height;
  const composite = frames.map((f, i) => ({ input: f.png, left: i * width, top: 0 }));
  await sharp({
    create: { width: width * frames.length, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .composite(composite)
    .png()
    .toFile(outPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) {
    console.error('Usage: node tools/bud_capture.mjs --out <dir> [--disabled] [--port <n>]');
    process.exit(1);
  }
  const outDir = path.resolve(args.out);
  fs.mkdirSync(outDir, { recursive: true });

  let backend = null;
  let devChild = null;
  let browser = null;

  try {
    backend = await startBackend();
    console.log(`[bud_capture] seeded backend on http://127.0.0.1:${backend.port} (data dir: ${backend.tmpDir})`);

    const vitePort = args.port || (await getFreePort());
    devChild = await startDevServer(vitePort, {
      VITE_API_BASE_URL: `http://127.0.0.1:${backend.port}`,
      VITE_API_TOKEN: backend.token,
    });
    console.log(`[bud_capture] vite dev server on http://localhost:${vitePort}`);

    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`http://localhost:${vitePort}`, { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('bud.tourDone', 'true');
      localStorage.setItem('bud.effectsEnabled', 'true');
      localStorage.setItem('bud.minimized', 'false');
      localStorage.setItem('bud.muted', 'true');
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__bud && typeof window.__bud.cue === 'function');

    // The rig's automatic idle-emote scheduler (a spontaneous wave/stretch/
    // groove/etc every 6-14s, gated on exprRef === 'idle') is independent of
    // both cue() and our own emote() calls and was polluting the diff metric:
    // one automatic pick landing mid-run could inflate several consecutive
    // cues' "vs rest" diff by ~2-3M channel units regardless of what we asked
    // for (seen in a dry run: nod/sulk/land all reading ~2.76M even with
    // --disabled). setExpr to a non-'idle' string turns that scheduler off
    // (BudThree.jsx: `idleOk = exprRef.current === 'idle' && ...`) without
    // touching startCue/startEmote, which this script drives directly and
    // don't check exprRef.
    await page.evaluate(() => window.__bud.setExpr('busy'));

    if (args.disabled) {
      await page.evaluate(() => window.__bud.disableCues());
      console.log('[bud_capture] --disabled: called window.__bud.disableCues() (red-proof run)');
    }

    // rest() then 5 frames 300ms apart, to build a stable median reference and
    // separately measure the rest-vs-rest noise floor. A single blink or idle
    // emote landing inside the window can spike ONE pairwise diff to 1M+
    // channel units (seen in dry runs); with only 3 samples that spike IS the
    // reported floor. With 5 samples (10 pairs) the MEDIAN pairwise diff is a
    // much more honest "typical" floor — one bad sample can only pollute 4 of
    // the 10 pairs, so the median still reads the quiet baseline.
    const REST_SAMPLE_COUNT = 5;
    async function captureRestSamples() {
      await page.evaluate(() => window.__bud.rest());
      const samples = [];
      for (let i = 0; i < REST_SAMPLE_COUNT; i += 1) {
        if (i > 0) await sleep(300);
        samples.push(await captureCanvas(page));
      }
      return samples;
    }

    const restSamples = await captureRestSamples();
    const restRaws = restSamples.map((s) => s.raw);
    const pairwiseDiffs = [];
    for (let i = 0; i < restRaws.length; i += 1) {
      for (let j = i + 1; j < restRaws.length; j += 1) {
        pairwiseDiffs.push(channelSumDiff(restRaws[i].data, restRaws[j].data));
      }
    }
    pairwiseDiffs.sort((a, b) => a - b);
    const noiseFloor = pairwiseDiffs[Math.floor(pairwiseDiffs.length / 2)]; // median of 10 pairs
    const threshold = noiseFloor * NOISE_MULTIPLIER;

    // Build the capture plan: [{ name, durSec, invoke: 'cue'|'emote' }]
    const plan = [];
    for (const [name, cue] of Object.entries(CUES)) {
      if (cue.dur <= 0) continue; // walk: dur 0 = "until stopped", not a fixed-length pose
      plan.push({ name, durSec: cue.dur, invoke: 'cue' });
    }
    for (const [name, durSec] of Object.entries(EXTRA_EMOTES)) {
      plan.push({ name, durSec, invoke: 'emote' });
    }

    const results = [];
    for (const item of plan) {
      // Reset to rest immediately before every capture group (per the
      // scratch-script lesson: an idle emote or blink landing in the window
      // is the dominant noise source, so start each cue from a known state).
      await page.evaluate(() => window.__bud.rest());
      await sleep(500);

      // A fresh "just before this cue" frame, not the run-global rest median.
      // A blink or micro-drift that happens to be mid-cycle at the moment the
      // global median was taken (minutes earlier, in a long run) would read
      // as false "reaction" motion on every cue compared against it; diffing
      // against THIS cue's own pre-frame cancels that out (seen in practice:
      // several non-wince/cheer reaction cues read ~2.78M vs the global rest
      // reference even under --disabled, all clustered on one recurring
      // event, and dropped back to noise-floor level once compared locally).
      const preFrame = await captureCanvas(page);

      const startedAt = Date.now();
      if (item.invoke === 'cue') {
        await page.evaluate((n) => window.__bud.cue(n), item.name);
      } else {
        await page.evaluate((n) => window.__bud.emote(n), item.name);
      }

      const frames = []; // every sampled frame (fine grid, for the diff metric)
      const sheetFrames = []; // just the 4 canonical frames (for the contact sheet)
      for (const pct of CAPTURE_PCTS) {
        const targetMs = startedAt + pct * item.durSec * 1000;
        const waitMs = targetMs - Date.now();
        if (waitMs > 0) await sleep(waitMs);
        const frame = await captureCanvas(page);
        frames.push(frame);
        if (SHEET_PCTS.includes(pct)) sheetFrames.push(frame);
      }

      // The reported/gated number is the SECOND-highest of the 8 fine-grid
      // diffs, not the max. A real reaction cue's pose stays away from rest
      // for a good chunk of its duration, so several samples read high; a
      // stray ~0.16s blink (BudThree.jsx's own independent timer, fires
      // every 2-6s regardless of cues) can only ever land in one sample and
      // is an outlier of one, not two (seen in practice: --disabled runs
      // read one or two reaction cues over threshold on the single-sample
      // max, none on the 2nd-highest).
      const diffs = frames.map((f) => channelSumDiff(f.raw.data, preFrame.raw.data));
      const sortedDesc = [...diffs].sort((a, b) => b - a);
      const maxDiff = sortedDesc[1];
      results.push({ name: item.name, invoke: item.invoke, isReaction: REACTION_CUES.has(item.name), maxDiff });

      await buildContactSheet(sheetFrames, path.join(outDir, `${item.name}.png`));
    }

    await browser.close();
    browser = null;

    // --- report ---
    console.log('');
    console.log(`[bud_capture] rest-vs-rest pairwise diffs (${pairwiseDiffs.length} pairs, sorted): ${pairwiseDiffs.map((d) => d.toFixed(0)).join(', ')}`);
    console.log(`[bud_capture] rest-vs-rest noise floor (median of pairs): ${noiseFloor.toFixed(0)} channel units`);
    console.log(`[bud_capture] pass rule: a reaction cue's 2nd-highest diff (of 8 fine-grid samples, vs its own pre-cue frame) must exceed ${NOISE_MULTIPLIER}x the noise floor (> ${threshold.toFixed(0)})`);
    console.log('');
    const nameWidth = Math.max(...results.map((r) => r.name.length), 'cue'.length) + 2;
    console.log(`${'cue'.padEnd(nameWidth)}${'type'.padEnd(10)}${'reaction?'.padEnd(11)}2nd-highest diff vs pre-cue frame`);
    for (const r of results) {
      console.log(
        `${r.name.padEnd(nameWidth)}${r.invoke.padEnd(10)}${(r.isReaction ? 'yes' : 'no').padEnd(11)}${r.maxDiff.toFixed(0)}`,
      );
    }

    const reactionResults = results.filter((r) => r.isReaction);
    const failed = reactionResults.filter((r) => r.maxDiff <= threshold);

    // index.html
    const rows = results
      .map(
        (r) => `<tr><td>${r.name}</td><td><img src="${r.name}.png" width="640"></td><td>${r.invoke}</td><td>${r.isReaction ? 'yes' : 'no'}</td><td>${r.maxDiff.toFixed(0)}</td><td>${r.isReaction ? (r.maxDiff > threshold ? 'PASS' : 'FAIL') : '-'}</td></tr>`,
      )
      .join('\n');
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Bud capture strip</title>
<style>body{font-family:sans-serif} table{border-collapse:collapse} td,th{border:1px solid #ccc;padding:4px 8px;vertical-align:top}</style>
</head><body>
<h1>Bud capture strip</h1>
<p>Each row: 4 frames at 0/30/60/90% of the cue's nominal duration, left to right. Noise floor is the
median of 10 pairwise diffs among 5 rest samples 300ms apart: ${noiseFloor.toFixed(0)}. Pass rule (reaction cues only):
2nd-highest diff (of 8 fine-grid samples) &gt; ${NOISE_MULTIPLIER}x noise floor (&gt; ${threshold.toFixed(0)}).</p>
<table>
<tr><th>cue</th><th>frames</th><th>invoked via</th><th>reaction?</th><th>2nd-highest diff</th><th>result</th></tr>
${rows}
</table>
</body></html>`;
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

    console.log('');
    console.log(`[bud_capture] wrote ${results.length} sheets + index.html to ${outDir}`);

    if (failed.length > 0) {
      console.log('');
      console.log(`[bud_capture] FAILED reaction cues (diff did not clear ${NOISE_MULTIPLIER}x noise floor): ${failed.map((f) => f.name).join(', ')}`);
      process.exitCode = 2;
    } else {
      console.log('[bud_capture] all reaction cues cleared the threshold.');
      process.exitCode = 0;
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (devChild) killTree(devChild.pid);
    if (backend) await backend.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[bud_capture] fatal:', error);
  process.exitCode = 1;
});
