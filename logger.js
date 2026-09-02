// Tiny append-only file logger. No Electron imports so it stays usable from
// both main.js and server.js (and from tests without an Electron runtime).
//
// Writes one line per call to `file`, rotating it once it exceeds `maxBytes`:
// the old file is renamed to `${file}.1` (overwriting any previous .1), so at
// most one rotated copy is ever kept alongside the live file. Mirrors to the
// console too, so behaviour under `npm run dev` / `electron .` is unchanged.

import fs from 'fs';
import path from 'path';

function appendLine(file, maxBytes, level, msg, meta) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const { size } = fs.statSync(file);
    if (size > maxBytes) {
      fs.renameSync(file, `${file}.1`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const suffix = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
  const line = `${new Date().toISOString()} ${level} ${msg}${suffix}\n`;
  fs.appendFileSync(file, line);
}

export function createLogger({ file, maxBytes = 1024 * 1024 }) {
  return {
    file,
    info(msg, meta) {
      appendLine(file, maxBytes, 'INFO', msg, meta);
      console.log(meta !== undefined ? `${msg} ${JSON.stringify(meta)}` : msg);
    },
    warn(msg, meta) {
      appendLine(file, maxBytes, 'WARN', msg, meta);
      console.error(meta !== undefined ? `${msg} ${JSON.stringify(meta)}` : msg);
    },
    error(msg, meta) {
      appendLine(file, maxBytes, 'ERROR', msg, meta);
      console.error(meta !== undefined ? `${msg} ${JSON.stringify(meta)}` : msg);
    },
  };
}

// For callers (mostly tests) that need the createServer/startServer shape
// but do not care where — or whether — anything gets logged.
export const nullLogger = {
  file: null,
  info() {},
  warn() {},
  error() {},
};
