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

  // pH is optional; when supplied it must be a number in the 0–14 range.
  const { ph } = body;
  if (ph !== undefined && ph !== null && ph !== '') {
    const phNum = parseFloat(ph);
    if (isNaN(phNum) || phNum < 0 || phNum > 14) {
      errors.push('pH must be a number between 0 and 14');
    }
  }

  return errors;
}

// Normalize an optional pH value to a number or null.
function parsePh(ph) {
  if (ph === undefined || ph === null || ph === '') return null;
  const phNum = parseFloat(ph);
  return isNaN(phNum) ? null : phNum;
}

// Validate a feeding-schedule payload. `partial` is true for updates, where
// only the supplied fields are checked.
export function validateSchedule(body, { partial } = { partial: false }) {
  const { plant_name, nutrient_type, ec_level, frequency, notes } = body;
  const errors = [];
  const allowedFrequencies = ['daily', 'every-2-days', 'weekly'];

  if (!partial || plant_name !== undefined) {
    if (!plant_name || typeof plant_name !== 'string' || plant_name.trim().length === 0) {
      errors.push('Plant name is required');
    } else if (plant_name.length > 100) {
      errors.push('Plant name must be less than 100 characters');
    }
  }

  if (!partial || nutrient_type !== undefined) {
    if (!nutrient_type || typeof nutrient_type !== 'string' || nutrient_type.trim().length === 0) {
      errors.push('Nutrient type is required');
    } else if (nutrient_type.length > 100) {
      errors.push('Nutrient type must be less than 100 characters');
    }
  }

  if (ec_level !== undefined && ec_level !== null && ec_level !== '' && String(ec_level).length > 20) {
    errors.push('EC level must be less than 20 characters');
  }

  if (frequency !== undefined && frequency !== '' && !allowedFrequencies.includes(frequency)) {
    errors.push(`Frequency must be one of: ${allowedFrequencies.join(', ')}`);
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

  // Write atomically: serialize to a temp file in the same directory, then
  // rename over the target so a crash mid-write can't leave a corrupt file.
  const writeData = (data) => {
    const tmpFile = `${dataFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
    fs.renameSync(tmpFile, dataFile);
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
      const fields = ['id', 'plant_name', 'date', 'height', 'ph', 'nutrients', 'notes', 'created_at'];
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

      const { plant_name, date, height, nutrients, notes, ph } = req.body;
      const data = readData();

      const newLog = {
        id: data.nextId,
        plant_name: plant_name.trim(),
        date,
        height: parseFloat(height),
        ph: parsePh(ph),
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

      const { plant_name, height, nutrients, notes, ph, date } = req.body;
      log.plant_name = plant_name.trim();
      log.height = parseFloat(height);
      log.nutrients = nutrients.trim();
      log.notes = notes?.trim() || '';
      if (ph !== undefined) log.ph = parsePh(ph);
      // Allow editing the entry date, but keep the original when omitted.
      if (date !== undefined && date !== '') log.date = date;
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

  // PUT /logs/plant/:plantName/rename – rename a plant across all its logs and
  // feeding schedules. Body: { new_name }.
  app.put('/logs/plant/:plantName/rename', (req, res) => {
    try {
      const oldName = decodeURIComponent(req.params.plantName);
      const newName = (req.body.new_name || '').trim();

      if (!newName) {
        return res.status(400).json({ error: 'Validation failed', details: ['New plant name is required'] });
      }
      if (newName.length > 100) {
        return res.status(400).json({ error: 'Validation failed', details: ['Plant name must be less than 100 characters'] });
      }

      const data = readData();
      let renamed = 0;
      data.logs.forEach((log) => {
        if (log.plant_name === oldName) {
          log.plant_name = newName;
          renamed += 1;
        }
      });
      data.schedules.forEach((schedule) => {
        if (schedule.plant_name === oldName) schedule.plant_name = newName;
      });

      if (renamed === 0) {
        return res.status(404).json({ error: `No logs found for plant "${oldName}"` });
      }

      writeData(data);
      res.json({ message: `Renamed "${oldName}" to "${newName}"`, renamed });
    } catch (error) {
      console.error('Error renaming plant:', error);
      res.status(500).json({ error: 'Failed to rename plant' });
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

      const errors = validateSchedule(req.body, { partial: false });
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
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

  // PUT /feeding/:id – update an existing feeding schedule.
  app.put('/feeding/:id', (req, res) => {
    try {
      const errors = validateSchedule(req.body, { partial: true });
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }

      const scheduleId = parseInt(req.params.id, 10);
      const data = readData();
      const schedule = data.schedules.find((s) => s.id === scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Feeding schedule not found' });
      }

      const { plant_name, nutrient_type, ec_level, frequency, notes } = req.body;
      if (plant_name !== undefined) schedule.plant_name = plant_name;
      if (nutrient_type !== undefined) schedule.nutrient_type = nutrient_type;
      if (ec_level !== undefined) schedule.ec_level = ec_level;
      if (frequency !== undefined) schedule.frequency = frequency;
      if (notes !== undefined) schedule.notes = notes;
      schedule.updated_at = new Date().toISOString();

      writeData(data);
      res.json(schedule);
    } catch (error) {
      console.error('Error updating feeding schedule:', error);
      res.status(500).json({ error: 'Failed to update feeding schedule' });
    }
  });

  // POST /feeding/:id/fed – mark a schedule as fed now (or at a given date).
  app.post('/feeding/:id/fed', (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const data = readData();
      const schedule = data.schedules.find((s) => s.id === scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Feeding schedule not found' });
      }

      const { fed_at } = req.body || {};
      if (fed_at && isNaN(Date.parse(fed_at))) {
        return res.status(400).json({ error: 'Validation failed', details: ['fed_at must be a valid date'] });
      }
      schedule.last_fed = fed_at ? new Date(fed_at).toISOString() : new Date().toISOString();

      writeData(data);
      res.json(schedule);
    } catch (error) {
      console.error('Error marking schedule fed:', error);
      res.status(500).json({ error: 'Failed to mark schedule as fed' });
    }
  });

  // DELETE /feeding/:id – delete a feeding schedule.
  app.delete('/feeding/:id', (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const data = readData();
      const index = data.schedules.findIndex((s) => s.id === scheduleId);

      if (index === -1) {
        return res.status(404).json({ error: 'Feeding schedule not found' });
      }

      const [deleted] = data.schedules.splice(index, 1);
      writeData(data);
      res.json({ message: `Successfully deleted schedule with ID: ${scheduleId}`, deleted });
    } catch (error) {
      console.error('Error deleting feeding schedule:', error);
      res.status(500).json({ error: 'Failed to delete feeding schedule' });
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
