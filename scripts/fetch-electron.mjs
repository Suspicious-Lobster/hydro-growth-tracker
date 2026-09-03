// Fetch the Electron binary into node_modules/electron/dist on a machine whose
// Node cannot run electron's own postinstall (its downloader is ESM-only and
// electron/install.js require()s it; Node 20 refuses). Same download, same
// layout the installer produces, done from an ESM entry point instead.
//
//   npm install --ignore-scripts && node scripts/fetch-electron.mjs
//
// Idempotent: exits at once when dist/electron.exe (or the platform binary)
// already exists.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { downloadArtifact } from '@electron/get';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const { version } = require(path.join(electronDir, 'package.json'));
const binaryName = process.platform === 'win32' ? 'electron.exe'
  : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
const distDir = path.join(electronDir, 'dist');

if (fs.existsSync(path.join(distDir, binaryName))) {
  console.log(`electron ${version} binary already present at ${distDir}`);
  process.exit(0);
}

console.log(`downloading electron ${version} for ${process.platform}-${process.arch}...`);
const zipPath = await downloadArtifact({ version, artifactName: 'electron', platform: process.platform, arch: process.arch });
const bytes = fs.statSync(zipPath).size;
if (bytes < 1024 * 1024) throw new Error(`downloaded zip is only ${bytes} bytes; refusing to extract`);
fs.mkdirSync(distDir, { recursive: true });
new AdmZip(zipPath).extractAllTo(distDir, true);
if (!fs.existsSync(path.join(distDir, binaryName))) throw new Error(`extraction produced no ${binaryName}`);
fs.writeFileSync(path.join(electronDir, 'path.txt'), binaryName);
console.log(`electron ${version} ready: ${path.join(distDir, binaryName)} (${bytes} byte zip)`);
