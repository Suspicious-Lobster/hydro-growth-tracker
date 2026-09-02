import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const PORT = 5000;

let mainWindow;
let backendServer;

// Resolve where data and uploads live. In development we keep them next to the
// source for convenience; in production they go in the per-user app data dir so
// they survive app updates and live in a writable location.
function storagePaths() {
  const baseDir = isDev ? __dirname : app.getPath('userData');
  return {
    dataFile: path.join(baseDir, 'hydro-data.json'),
    uploadsDir: path.join(baseDir, 'uploads'),
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
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
    const { dataFile, uploadsDir } = storagePaths();
    const { httpServer, state } = await startServer({ dataFile, uploadsDir, port: PORT });
    backendServer = httpServer;
    createWindow();
    if (state.damaged) {
      // The store could not be read. Nothing will be written until the user
      // repairs or restores it; tell them where the salvaged bytes are.
      const { dialog } = await import('electron');
      dialog.showErrorBox(
        'Your plant data could not be read',
        `${state.damaged.error}\n\nData file: ${state.damaged.dataFile}\n` +
        `A copy of the unreadable file was saved as: ${state.damaged.salvagePath}\n\n` +
        `To recover, restore a backup from Settings, or replace the data file with a good copy and restart.` +
        (state.damaged.detail ? `\n\nDetail: ${state.damaged.detail}` : ''),
      );
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
