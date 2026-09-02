import { app, BrowserWindow } from 'electron';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer, DEFAULT_ALLOWED_ORIGINS } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const DEV_RENDERER_ORIGIN = 'http://localhost:5173';

let mainWindow;
let backendServer;
// Where the backend ended up and the secret the renderer must present. Both
// are minted per launch and reach the renderer only through preload.js.
let backend = { apiBase: null, token: null };

// Resolve where data and uploads live. In development we keep them next to the
// source for convenience; in production they go in the per-user app data dir so
// they survive app updates and live in a writable location.
function storagePaths() {
  const baseDir = isDev ? __dirname : app.getPath('userData');
  return {
    dataFile: path.join(baseDir, 'hydro-data.json'),
    uploadsDir: path.join(baseDir, 'uploads'),
    backupsDir: path.join(baseDir, 'backups'),
  };
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
    const { dataFile, uploadsDir, backupsDir } = storagePaths();
    const token = crypto.randomBytes(32).toString('hex');
    const allowedOrigins = isDev ? [...DEFAULT_ALLOWED_ORIGINS, DEV_RENDERER_ORIGIN] : DEFAULT_ALLOWED_ORIGINS;
    // port 0: the OS picks a free loopback port (a fixed 5000 collides with
    // macOS AirPlay Receiver); the renderer learns the real one via preload.
    const { httpServer, state, apiBase } = await startServer({ dataFile, uploadsDir, backupsDir, port: 0, token, allowedOrigins });
    backendServer = httpServer;
    backend = { apiBase, token };
    createWindow();
    if (state.damaged) {
      // The store cannot be served: unreadable (salvaged copy exists) or
      // written by a newer version (file intact, no copy). Nothing will be
      // written until the user acts; say where every recovery file lives.
      const { dialog } = await import('electron');
      const d = state.damaged;
      const lines = [d.error, '', `Data file: ${d.dataFile}`];
      if (d.salvagePath) lines.push(`A copy of the unreadable file was saved as: ${d.salvagePath}`);
      lines.push(`Daily backups: ${backupsDir}`, `Last good copy: ${dataFile}.bak`, '');
      lines.push(d.tooNew
        ? 'Update Hydro Growth Tracker to open this file, or restore an older backup from Settings after updating.'
        : 'To recover, restore a backup from Settings, or replace the data file with a good copy and restart.');
      if (d.detail) lines.push('', `Detail: ${d.detail}`);
      dialog.showErrorBox(d.tooNew ? 'Your plant data needs a newer version' : 'Your plant data could not be read', lines.join('\n'));
    }
  } catch (error) {
    console.error('Error during app startup:', error);
    const { dialog } = await import('electron');
    dialog.showErrorBox('Startup Error', `Failed to start the application: ${error.message}`);
  }
});

app.on('window-all-closed', () => {
  if (backendServer) {
    backendServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
