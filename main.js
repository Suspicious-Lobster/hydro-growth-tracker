const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const url = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, 'frontend', 'dist', 'index.html')}`;

  mainWindow.loadURL(url);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const backendPath = path.join(__dirname, 'backend', 'app.js');
  let nodeExe = 'node';
  if (process.env.NODE_ENV !== 'development') {
    nodeExe = path.join(process.resourcesPath, 'node.exe');
  }
  console.log('Spawning backend with:', nodeExe, backendPath);
  backendProcess = spawn(nodeExe, [backendPath], {
    env: { ...process.env, PORT: 5000 },
    stdio: 'inherit'
  });
  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });
  backendProcess.on('exit', (code) => {
    console.error('Backend exited with code:', code);
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
