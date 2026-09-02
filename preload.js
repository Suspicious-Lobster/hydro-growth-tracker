// Preload: the only bridge between the renderer and the Electron shell.
//
// main.js starts the embedded backend on a random loopback port with a random
// per-launch token, and passes both here through `additionalArguments`. The
// renderer reads them as `window.hydro` (see frontend/src/api/api.js). Nothing
// else from Node or Electron is exposed; contextIsolation stays on.
//
// Plain CommonJS on purpose: sandboxed preload scripts are loaded by Electron's
// own wrapper, not Node's ESM loader, regardless of package.json "type".
const { contextBridge } = require('electron');

const argValue = (name) => {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
};

contextBridge.exposeInMainWorld('hydro', {
  apiBase: argValue('hydro-api-base'),
  token: argValue('hydro-token'),
  version: argValue('hydro-version'),
});
