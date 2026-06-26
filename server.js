// Embedded backend for Hydro Growth Tracker.
//
// This Express app is backed by a single JSON file and is the app's only
// data service in both development and production. It is created as a factory
// so the Electron main process can supply storage paths, and so it can be
// exercised in isolation by tests.

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';

// Default shape of the JSON data file.
export const emptyData = () => ({ logs: [], schedules: [], nextId: 1, nextScheduleId: 1 });

// Validate a log payload. `requireDate` is false for updates, where the edit
// form does not resend the date.
export function validateLog(body, { requireDate } = { requireDate: true }) {
  const { plant_name, date, height, nutrients, notes } = body;
  const errors = [];

  if (!plant_name || typeof plant_name !== 'string' || plant_name.trim().length === 0) {
    errors.push('Plant name is required and must be a non-empty string');
  } else if (plant_name.length > 100) {
    errors.push('Plant name must be less than 100 characters');
  }

  if (requireDate) {
    if (!date) {
      errors.push('Date is required');
    } else if (isNaN(Date.parse(date))) {
      errors.push('Date must be a valid date format');
    }
  }

  if (height === undefined || height === null || height === '') {
    errors.push('Height is required');
  } else {
    const heightNum = parseFloat(height);
    if (isNaN(heightNum) || heightNum < 0 || heightNum > 1000) {
      errors.push('Height must be a number between 0 and 1000 cm');
    }
  }

  if (!nutrients || typeof nutrients !== 'string' || nutrients.trim().length === 0) {
    errors.push('Nutrients information is required');
  } else if (nutrients.length > 500) {
    errors.push('Nutrients description must be less than 500 characters');
  }

  if (notes && notes.length > 1000) {
    errors.push('Notes must be less than 1000 characters');
  }

  return errors;
}

// Build the Express app. `dataFile` is the JSON store path; `uploadsDir` is
// where images are written and served from. Both are created if missing.
export function createServer({ dataFile, uploadsDir }) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(emptyData(), null, 2));
  }

  // Read data, tolerating older files that predate the `schedules` collection.
  const readData = () => {
    try {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      return { ...emptyData(), ...parsed };
    } catch (error) {
      console.error('Error reading data:', error);
      return emptyData();
    }
  };

  const writeData = (data) => {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  };

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cors({ origin: true, credentials: true }));
  app.use('/uploads', express.static(uploadsDir));

  // Image uploads: sanitized filenames, image-only, 5MB cap.
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}-${sanitized}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and GIF images are allowed.'));
      }
    },
  });

  app.get('/', (_req, res) => {
    res.json({ status: 'Backend running', timestamp: new Date().toISOString() });
  });

  /* ---------------------------- Logs ---------------------------- */

  // GET /logs – all logs, newest first.
  app.get('/logs', (_req, res) => {
    try {
      const data = readData();
      const logs = [...data.logs].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // GET /logs/export – CSV download.
  app.get('/logs/export', (_req, res) => {
    try {
      const data = readData();
      const fields = ['id', 'plant_name', 'height', 'nutrients', 'notes', 'created_at'];
      const parser = new Parser({ fields });
      const csv = parser.parse(data.logs);
      res.header('Content-Type', 'text/csv');
      res.attachment(`hydro_logs_${Date.now()}.csv`);
      res.send(csv);
    } catch (error) {
      console.error('Error exporting logs:', error);
      res.status(500).json({ error: 'Failed to export logs' });
    }
  });

  // POST /logs – create a log, with optional image upload.
  app.post('/logs', upload.single('image'), (req, res) => {
    try {
      const errors = validateLog(req.body, { requireDate: true });
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      const { plant_name, date, height, nutrients, notes } = req.body;
      const data = readData();

      const newLog = {
        id: data.nextId,
        plant_name: plant_name.trim(),
        date,
        height: parseFloat(height),
        nutrients: nutrients.trim(),
        notes: notes?.trim() || '',
        image_url: req.file ? `/uploads/${req.file.filename}` : null,
        created_at: new Date().toISOString(),
      };

      data.logs.push(newLog);
      data.nextId += 1;
      writeData(data);
      res.status(201).json(newLog);
    } catch (error) {
      console.error('Error adding log:', error);
      res.status(500).json({ error: 'Failed to add log' });
    }
  });

  // PUT /logs/:id – update a log (date and image are preserved).
  app.put('/logs/:id', (req, res) => {
    try {
      const errors = validateLog(req.body, { requireDate: false });
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      const logId = parseInt(req.params.id, 10);
      const data = readData();
      const log = data.logs.find((l) => l.id === logId);

      if (!log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      const { plant_name, height, nutrients, notes } = req.body;
      log.plant_name = plant_name.trim();
      log.height = parseFloat(height);
      log.nutrients = nutrients.trim();
      log.notes = notes?.trim() || '';
      log.updated_at = new Date().toISOString();

      writeData(data);
      res.json(log);
    } catch (error) {
      console.error('Error updating log:', error);
      res.status(500).json({ error: 'Failed to update log' });
    }
  });

  // DELETE /logs/plant/:plantName – delete all logs for a plant.
  app.delete('/logs/plant/:plantName', (req, res) => {
    try {
      const plantName = decodeURIComponent(req.params.plantName);
      const data = readData();
      const initialCount = data.logs.length;

      data.logs = data.logs.filter((log) => log.plant_name !== plantName);
      const deletedCount = initialCount - data.logs.length;

      writeData(data);
      res.json({
        message: `Deleted ${deletedCount} logs for plant "${plantName}"`,
        deletedCount,
      });
    } catch (error) {
      console.error('Error deleting plant logs:', error);
      res.status(500).json({ error: 'Failed to delete plant logs' });
    }
  });

  // DELETE /logs/:id – delete a single log.
  app.delete('/logs/:id', (req, res) => {
    try {
      const logId = parseInt(req.params.id, 10);
      const data = readData();
      const logIndex = data.logs.findIndex((log) => log.id === logId);

      if (logIndex === -1) {
        return res.status(404).json({ error: 'Log not found' });
      }

      const [deletedLog] = data.logs.splice(logIndex, 1);
      writeData(data);
      res.json({ message: `Successfully deleted log with ID: ${logId}`, deletedLog });
    } catch (error) {
      console.error('Error deleting log:', error);
      res.status(500).json({ error: 'Failed to delete log' });
    }
  });

  /* -------------------------- Feeding --------------------------- */

  // GET /feeding – all saved feeding schedules.
  app.get('/feeding', (_req, res) => {
    try {
      const data = readData();
      res.json(data.schedules);
    } catch (error) {
      console.error('Error fetching feeding schedules:', error);
      res.status(500).json({ error: 'Failed to fetch feeding schedules' });
    }
  });

  // POST /feeding – create a feeding schedule.
  app.post('/feeding', (req, res) => {
    try {
      const { plant_name, nutrient_type, ec_level, frequency, notes } = req.body;

      if (!plant_name || !nutrient_type) {
        return res.status(400).json({
          error: 'Validation failed',
          details: ['Plant name and nutrient type are required'],
        });
      }

      const data = readData();
      const newSchedule = {
        id: data.nextScheduleId,
        plant_name,
        nutrient_type,
        ec_level: ec_level || '',
        frequency: frequency || 'daily',
        notes: notes || '',
        last_fed: null,
        created_at: new Date().toISOString(),
      };

      data.schedules.push(newSchedule);
      data.nextScheduleId += 1;
      writeData(data);
      res.status(201).json(newSchedule);
    } catch (error) {
      console.error('Error adding feeding schedule:', error);
      res.status(500).json({ error: 'Failed to add feeding schedule' });
    }
  });

  // Multer / upload errors land here as JSON instead of an HTML stack trace.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('Backend error:', err.message);
    res.status(400).json({ error: err.message || 'Something went wrong' });
  });

  return app;
}

// Convenience helper used by the Electron main process.
export function startServer({ dataFile, uploadsDir, port = 5000 }) {
  const app = createServer({ dataFile, uploadsDir });
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, () => {
      console.log(`Embedded backend running on port ${port} (JSON storage)`);
      resolve(httpServer);
    });
    httpServer.on('error', reject);
  });
}
