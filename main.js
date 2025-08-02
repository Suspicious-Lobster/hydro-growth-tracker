import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;
let backendServer;

// Embedded backend server
function startEmbeddedBackend() {
  try {
    // Import the backend routes directly
    const backendApp = express();
    
    // Basic middleware
    backendApp.use(express.json({ limit: '10mb' }));
    backendApp.use(express.urlencoded({ extended: true, limit: '10mb' }));
    backendApp.use(cors({
      origin: true,
      credentials: true
    }));

    // Simple route for testing
    backendApp.get('/', (req, res) => {
      res.json({ status: 'Backend running', timestamp: new Date().toISOString() });
    });

    // Mock logs endpoint for now
    let logs = [
      {
        id: 1,
        plant_name: 'Sample Plant',
        date: '2025-08-02',
        height: 10,
        nutrients: 'NPK 10-10-10',
        notes: 'Initial log',
        image_url: null,
        created_at: '2025-08-02T12:00:00Z'
      }
    ];

    backendApp.get('/logs', (req, res) => {
      res.json(logs);
    });

    backendApp.post('/logs', (req, res) => {
      const { plant_name, date, height, nutrients, notes } = req.body;
      const newLog = {
        id: logs.length + 1,
        plant_name,
        date,
        height: parseFloat(height),
        nutrients,
        notes: notes || '',
        image_url: null,
        created_at: new Date().toISOString()
      };
      logs.push(newLog);
      res.status(201).json(newLog);
    });

    // Delete individual log by ID
    backendApp.delete('/logs/:id', (req, res) => {
      const logId = parseInt(req.params.id);
      const logIndex = logs.findIndex(log => log.id === logId);
      
      if (logIndex === -1) {
        return res.status(404).json({ error: 'Log not found' });
      }
      
      const deletedLog = logs.splice(logIndex, 1)[0];
      res.json({ message: 'Log deleted successfully', log: deletedLog });
    });

    // Delete all logs for a specific plant
    backendApp.delete('/api/plants/:plantName', (req, res) => {
      const plantName = req.params.plantName;
      const initialCount = logs.length;
      logs = logs.filter(log => log.plant_name !== plantName);
      const deletedCount = initialCount - logs.length;
      
      res.json({ 
        message: `Deleted ${deletedCount} logs for plant "${plantName}"`,
        deletedCount 
      });
    });

    // Delete all logs for a specific plant (alternative endpoint for PlantManager)
    backendApp.delete('/logs/plant/:plantName', (req, res) => {
      const plantName = decodeURIComponent(req.params.plantName);
      const initialCount = logs.length;
      logs = logs.filter(log => log.plant_name !== plantName);
      const deletedCount = initialCount - logs.length;
      
      res.json({ 
        message: `Deleted ${deletedCount} logs for plant "${plantName}"`,
        deletedCount 
      });
    });

    const PORT = 5000;
    backendServer = backendApp.listen(PORT, () => {
      console.log(`Embedded backend server running on port ${PORT}`);
    });

    return true;
  } catch (error) {
    console.error('Failed to start embedded backend:', error);
    return false;
  }
}

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

app.whenReady().then(async () => {
  console.log('App ready, starting embedded backend...');
  
  // Start embedded backend
  const backendStarted = startEmbeddedBackend();
  
  if (backendStarted) {
    console.log('Embedded backend started successfully');
  } else {
    console.error('Failed to start embedded backend');
  }
  
  // Small delay to ensure backend is ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('Creating window...');
  createWindow();
});

app.on('window-all-closed', () => {
  if (backendServer) {
    backendServer.close();
  }
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
