import { app, BrowserWindow, Menu, dialog } from 'electron';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer, DEFAULT_ALLOWED_ORIGINS } from './server.js';
import { wireLifecycle } from './lifecycle.js';
import { createLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const DEV_RENDERER_ORIGIN = 'http://localhost:5173';

let mainWindow;
let backendServer;
let logger;
// Where the backend ended up and the secret the renderer must present. Both
// are minted per launch and reach the renderer only through preload.js.
let backend = { apiBase: null, token: null };

// Resolve where data and uploads live. In development we keep them next to the
// source for convenience; in production they go in the per-user app data dir so
// they survive app updates and live in a writable location.
function storagePaths() {
  // HYDRO_USER_DATA lets the Playwright suite point a real launch at a temp
  // folder so it never touches the owner's data.
  const baseDir = process.env.HYDRO_USER_DATA || (isDev ? __dirname : app.getPath('userData'));
  return {
    baseDir,
    dataFile: path.join(baseDir, 'hydro-data.json'),
    uploadsDir: path.join(baseDir, 'uploads'),
    backupsDir: path.join(baseDir, 'backups'),
  };
}

// MR-15: a minimal menu in production (no DevTools item — nothing should
// hand an end user a JS console into their own plant data), the full dev
// menu (with Toggle Developer Tools) when running from source.
function buildMenu() {
  const helpMenu = {
    label: 'Help',
    submenu: [
      {
        label: 'About Hydro Growth Tracker',
        click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About Hydro Growth Tracker',
            message: 'Hydro Growth Tracker',
            detail: `Version ${app.getVersion()}`,
          });
        },
      },
    ],
  };

  const viewSubmenu = [
    { role: 'reload' },
    { role: 'togglefullscreen' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
  ];
  if (isDev) {
    viewSubmenu.push({ type: 'separator' }, { role: 'toggleDevTools' });
  }

  const template = [
    {
      label: 'File',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'View',
      submenu: viewSubmenu,
    },
    helpMenu,
  ];

  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icons', 'icon.png')
    : path.join(__dirname, 'assets', 'icons', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
      // Read by preload.js and exposed to the page as window.hydro.
      additionalArguments: [
        `--hydro-api-base=${backend.apiBase}`,
        `--hydro-token=${backend.token}`,
        `--hydro-version=${app.getVersion()}`,
      ],
    },
  });

  Menu.setApplicationMenu(buildMenu());

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const url = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, 'frontend', 'dist', 'index.html')}`;

  console.log('Loading URL:', url);
  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  try {
    const { baseDir, dataFile, uploadsDir, backupsDir } = storagePaths();
    logger = createLogger({ file: path.join(baseDir, 'logs', 'hydro.log') });
    logger.info('app start', { version: app.getVersion(), baseDir, dataFile, uploadsDir, backupsDir });
    const token = crypto.randomBytes(32).toString('hex');
    const allowedOrigins = isDev ? [...DEFAULT_ALLOWED_ORIGINS, DEV_RENDERER_ORIGIN] : DEFAULT_ALLOWED_ORIGINS;
    // port 0: the OS picks a free loopback port (a fixed 5000 collides with
    // macOS AirPlay Receiver); the renderer learns the real one via preload.
    const { httpServer, state, apiBase } = await startServer({ dataFile, uploadsDir, backupsDir, port: 0, token, allowedOrigins, logger });
    backendServer = httpServer;
    backend = { apiBase, token };
    createWindow();
    if (state.damaged) {
      // The store cannot be served: unreadable (salvaged copy exists) or
      // written by a newer version (file intact, no copy). Nothing will be
      // written until the user acts; say where every recovery file lives.
      const d = state.damaged;
      const lines = [d.error, '', `Data file: ${d.dataFile}`];
      if (d.salvagePath) lines.push(`A copy of the unreadable file was saved as: ${d.salvagePath}`);
      lines.push(`Daily backups: ${backupsDir}`, `Last good copy: ${dataFile}.bak`, '');
      lines.push(d.tooNew
        ? 'Update Hydro Growth Tracker to open this file, or restore an older backup from Settings after updating.'
        : 'To recover, restore a backup from Settings, or replace the data file with a good copy and restart.');
      if (d.detail) lines.push('', `Detail: ${d.detail}`);
      // showErrorBox is synchronous and blocks the main process, which on
      // Electron 44 kept the window from ever surfacing (the e2e damaged-file
      // spec timed out 2 of 3 runs). Show the async box once the window is up.
      const title = d.tooNew ? 'Your plant data needs a newer version' : 'Your plant data could not be read';
      const show = () => dialog.showMessageBox(mainWindow, { type: 'error', title, message: title, detail: lines.join('\n') });
      if (mainWindow && mainWindow.isVisible()) show(); else mainWindow?.once('show', show);
    }
  } catch (error) {
    if (logger) logger.error('Error during app startup', { message: error.message, stack: error.stack });
    else console.error('Error during app startup:', error);
    dialog.showErrorBox('Startup Error', `Failed to start the application: ${error.message}`);
  }
});

// A failed migration, a damaged store, or a route throw would otherwise be
// invisible in a packaged app (there is no console to see them in); log the
// full error and tell the user where the log lives instead of just crashing.
process.on('uncaughtException', (error) => {
  const logPath = logger ? logger.file : path.join(storagePaths().baseDir, 'logs', 'hydro.log');
  if (logger) logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  else console.error('Uncaught exception:', error);
  dialog.showErrorBox('Something went wrong', `An unexpected error occurred.\n\nDetails were written to: ${logPath}`);
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  const logPath = logger ? logger.file : path.join(storagePaths().baseDir, 'logs', 'hydro.log');
  if (logger) logger.error('Unhandled rejection', { message: error.message, stack: error.stack });
  else console.error('Unhandled rejection:', error);
  dialog.showErrorBox('Something went wrong', `An unexpected error occurred.\n\nDetails were written to: ${logPath}`);
});

// Single instance, macOS reopen, and closing the backend on quit (not on the
// last window closing) all live in lifecycle.js so they can be unit-tested.
wireLifecycle(app, {
  platform: process.platform,
  createWindow,
  getWindow: () => mainWindow,
  closeServer: () => { if (backendServer) backendServer.close(); },
});
