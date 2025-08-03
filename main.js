import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess;
let backendServer;
let dataFilePath;

// Initialize JSON file storage
function initDataStorage() {
  try {
    if (process.env.NODE_ENV === 'development') {
      // Development: use local data file
      dataFilePath = path.join(__dirname, 'hydro-data.json');
    } else {
      // Production: use app data directory
      const userDataPath = app.getPath('userData');
      dataFilePath = path.join(userDataPath, 'hydro-data.json');
    }
    
    console.log('Data file path:', dataFilePath);
    
    // Create data file if it doesn't exist
    if (!fs.existsSync(dataFilePath)) {
      const initialData = { logs: [], nextId: 1 };
      fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
      console.log('Created new data file');
    }
    
    console.log('Data storage initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize data storage:', error);
    return false;
  }
}

// Read data from JSON file
function readData() {
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    return { logs: [], nextId: 1 };
  }
}

// Write data to JSON file
function writeData(data) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
}

// Embedded backend server with JSON file persistence
async function startEmbeddedBackend() {
  try {
    // Initialize data storage first
    const storageOk = initDataStorage();
    if (!storageOk) {
      throw new Error('Failed to initialize data storage');
    }
    
    const backendApp = express();
    
    // Basic middleware
    backendApp.use(express.json({ limit: '10mb' }));
    backendApp.use(express.urlencoded({ extended: true, limit: '10mb' }));
    backendApp.use(cors({
      origin: true,
      credentials: true
    }));

    // Health check
    backendApp.get('/', (req, res) => {
      res.json({ status: 'Backend running', timestamp: new Date().toISOString() });
    });

    // GET /logs - Fetch all logs from JSON file
    backendApp.get('/logs', (req, res) => {
      try {
        const data = readData();
        res.json(data.logs);
      } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
      }
    });

    // POST /logs - Add new log to JSON file
    backendApp.post('/logs', (req, res) => {
      try {
        const { plant_name, date, height, nutrients, notes } = req.body;
        const data = readData();
        
        const newLog = {
          id: data.nextId,
          plant_name,
          date,
          height: parseFloat(height),
          nutrients,
          notes: notes || '',
          image_url: null,
          created_at: new Date().toISOString()
        };
        
        data.logs.push(newLog);
        data.nextId++;
        
        if (writeData(data)) {
          res.status(201).json(newLog);
        } else {
          throw new Error('Failed to save data');
        }
      } catch (error) {
        console.error('Error adding log:', error);
        res.status(500).json({ error: 'Failed to add log' });
      }
    });

    // DELETE /logs/:id - Delete individual log
    backendApp.delete('/logs/:id', (req, res) => {
      try {
        const logId = parseInt(req.params.id);
        const data = readData();
        const logIndex = data.logs.findIndex(log => log.id === logId);
        
        if (logIndex === -1) {
          return res.status(404).json({ error: 'Log not found' });
        }
        
        data.logs.splice(logIndex, 1);
        
        if (writeData(data)) {
          res.json({ message: 'Log deleted successfully' });
        } else {
          throw new Error('Failed to save data');
        }
      } catch (error) {
        console.error('Error deleting log:', error);
        res.status(500).json({ error: 'Failed to delete log' });
      }
    });

    // DELETE /logs/plant/:plantName - Delete all logs for a plant
    backendApp.delete('/logs/plant/:plantName', (req, res) => {
      try {
        const plantName = decodeURIComponent(req.params.plantName);
        const data = readData();
        const initialCount = data.logs.length;
        
        data.logs = data.logs.filter(log => log.plant_name !== plantName);
        const deletedCount = initialCount - data.logs.length;
        
        if (writeData(data)) {
          res.json({ 
            message: `Deleted ${deletedCount} logs for plant "${plantName}"`,
            deletedCount 
          });
        } else {
          throw new Error('Failed to save data');
        }
      } catch (error) {
        console.error('Error deleting plant logs:', error);
        res.status(500).json({ error: 'Failed to delete plant logs' });
      }
    });

    const PORT = 5000;
    backendServer = backendApp.listen(PORT, () => {
      console.log(`Embedded backend server running on port ${PORT} with JSON file persistence`);
    });

    // Add error handling for server
    backendServer.on('error', (error) => {
      console.error('Backend server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.log('Port 5000 is busy, trying port 5001...');
        backendServer = backendApp.listen(5001, () => {
          console.log(`Embedded backend server running on port 5001 with JSON file persistence`);
        });
      }
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
    show: false, // Don't show until ready
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Show window when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
  });

  const url = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, 'frontend', 'dist', 'index.html')}`;

  console.log('Loading URL:', url);
  mainWindow.loadURL(url);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  console.log('App ready, starting embedded backend...');
  
  try {
    // Start embedded backend
    const backendStarted = await startEmbeddedBackend();
    
    if (backendStarted) {
      console.log('Embedded backend started successfully');
    } else {
      console.error('Failed to start embedded backend');
      // Show error dialog if backend fails
      const { dialog } = require('electron');
      dialog.showErrorBox('Database Error', 'Failed to start the database. The app may not function properly.');
    }
    
    // Small delay to ensure backend is ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Creating window...');
    createWindow();
  } catch (error) {
    console.error('Error during app startup:', error);
    const { dialog } = require('electron');
    dialog.showErrorBox('Startup Error', `Failed to start the application: ${error.message}`);
  }
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
