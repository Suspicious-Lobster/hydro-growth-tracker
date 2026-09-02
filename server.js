// Embedded backend for Hydro Growth Tracker.
//
// This Express app is backed by a single JSON file and is the app's only data
// service in both development and production. File I/O and the data shape live
// in db/repository.js; this module is just the HTTP layer. It is created as a
// factory so the Electron main process can supply storage paths, and so it can
// be exercised in isolation by tests.

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Parser } from 'json2csv';
import fs from 'fs';

import * as repo from './db/repository.js';
import { runMigration, migrateData } from './db/migrate.js';
import { validateLog, validatePlant, validateSchedule } from './validation.js';

// Marker embedded in exported backups so a restore can recognize its own files
// (and reject an unrelated JSON) before replacing the store.
const BACKUP_TYPE = 'hydro-growth-tracker-backup';

// Re-exported for backward compatibility with existing importers/tests.
export const emptyData = repo.emptyData;
export { validateLog };

// Origins the renderer can legitimately have. A packaged app loads the UI from
// file://, which browsers report as the opaque origin "null"; the Vite dev
// server is added by main.js in development only.
export const DEFAULT_ALLOWED_ORIGINS = ['null', 'file://'];

// Build the Express app. `dataFile` is the JSON store path; `uploadsDir` is
// where images are written and served from. Both are created if missing, and
// any older-schema data file is migrated up before the app serves a request.
//
// `token`: when set, every data route requires the header X-Hydro-Token to
// equal it (401 otherwise). main.js mints one per launch and hands it to the
// renderer through preload.js, so a web page open in the user's browser cannot
// read or wipe the store even though it can reach 127.0.0.1 (probe P1,
// 2026-09-02: CORS used to reflect ANY origin with credentials, with no auth).
// GET / (health) and /uploads/* (images loaded by <img>, which cannot send
// headers) stay open; upload filenames are random.
// `allowedOrigins`: the only Origins that receive CORS headers.
export function createServer({ dataFile, uploadsDir, token = null, allowedOrigins = DEFAULT_ALLOWED_ORIGINS }) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(dataFile)) {
    repo.save(dataFile, repo.emptyData());
  } else {
    // A migration failure (e.g. a read-only/full data dir) must not brick the
    // app: log it and serve the existing data rather than aborting startup.
    try {
      runMigration(dataFile);
    } catch (error) {
      console.error('Data migration failed; serving existing data as-is:', error.message);
    }
  }

  // Damaged-store state. When the data file exists but cannot be parsed, the
  // server keeps running so the user can see WHAT happened and WHERE the
  // salvaged bytes are, but every write is refused with 503: the one thing
  // that must never happen is a save that replaces their data with an empty
  // store (probe P3, 2026-09-02). Exposed as app.hydroState for the shell.
  const state = { damaged: null };
  const markDamaged = (err) => {
    state.damaged = {
      error: 'Data file is damaged and cannot be read. No changes will be saved until it is repaired or restored.',
      dataFile: err.dataFile,
      salvagePath: err.salvagePath,
      detail: err.cause?.message || String(err.cause || ''),
    };
    return state.damaged;
  };

  const readData = () => repo.load(dataFile);
  const writeData = (data) => {
    if (state.damaged) throw new repo.DamagedDataFileError(dataFile, state.damaged.salvagePath, new Error('refused: store damaged'));
    repo.save(dataFile, data);
  };

  // Probe once at startup so the shell can warn immediately; a file that goes
  // bad later is caught per request by handle().
  try {
    readData();
  } catch (error) {
    if (error instanceof repo.DamagedDataFileError) markDamaged(error);
    else throw error;
  }

  // A request may reference a plant by id; if so, that plant must exist.
  // Returns true when an id was supplied but resolves to nothing.
  const unknownPlantId = (data, body) => {
    const pid = body.plant_id;
    if (pid === undefined || pid === null || pid === '') return false;
    return !repo.getPlant(data, parseInt(pid, 10));
  };

  const app = express();
  app.hydroState = state;
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  // No wildcard, no credentials: only the renderer's own origin(s) get CORS
  // headers. Requests with no Origin (same-origin, curl, tests) pass through
  // untouched; the token check below is the actual guard.
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin ? false : allowedOrigins.includes(origin)),
    credentials: false,
    allowedHeaders: ['Content-Type', 'X-Hydro-Token'],
  }));
  app.use('/uploads', express.static(uploadsDir));

  // Per-launch token: required on every route except health and static uploads.
  if (token) {
    app.use((req, res, next) => {
      if (req.method === 'OPTIONS' || req.path === '/' || req.path.startsWith('/uploads/')) return next();
      if (req.get('X-Hydro-Token') === token) return next();
      res.status(401).json({ error: 'Unauthorized: this API only answers the Hydro Growth Tracker app' });
    });
  }

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

  // Small wrapper so each handler gets fresh data and a uniform 500 on throw.
  const handle = (fn) => (req, res) => {
    try {
      fn(req, res);
    } catch (error) {
      if (error instanceof repo.DamagedDataFileError) {
        const d = state.damaged || markDamaged(error);
        return res.status(503).json({ error: d.error, damaged: d });
      }
      console.error(`Error handling ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  app.get('/', (_req, res) => {
    res.json({
      status: state.damaged ? 'damaged' : 'Backend running',
      damaged: state.damaged,
      timestamp: new Date().toISOString(),
    });
  });

  /* ---------------------------- Plants ---------------------------- */

  // GET /plants – all plants (active only unless ?archived=true), A→Z.
  app.get('/plants', handle((req, res) => {
    const data = readData();
    const includeArchived = req.query.archived === 'true';
    res.json(repo.listPlants(data, { includeArchived }));
  }));

  // GET /plants/:id – one plant.
  app.get('/plants/:id', handle((req, res) => {
    const data = readData();
    const plant = repo.getPlant(data, parseInt(req.params.id, 10));
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    res.json(plant);
  }));

  // POST /plants – create a plant (name unique among active plants).
  app.post('/plants', handle((req, res) => {
    const errors = validatePlant(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    const existing = repo.findPlantByName(data, req.body.name);
    if (existing && !existing.archived) {
      return res.status(409).json({ error: 'A plant with this name already exists' });
    }
    const plant = repo.createPlant(data, req.body);
    writeData(data);
    res.status(201).json(plant);
  }));

  // PUT /plants/:id – update a plant; renaming cascades to logs & schedules.
  app.put('/plants/:id', handle((req, res) => {
    const errors = validatePlant(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (req.body.name) {
      const existing = repo.findPlantByName(data, req.body.name);
      if (existing && !existing.archived && existing.id !== parseInt(req.params.id, 10)) {
        return res.status(409).json({ error: 'A plant with this name already exists' });
      }
    }
    const plant = repo.updatePlant(data, parseInt(req.params.id, 10), req.body);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    writeData(data);
    res.json(plant);
  }));

  // POST /plants/:id/archive – soft delete (keeps logs).
  app.post('/plants/:id/archive', handle((req, res) => {
    const data = readData();
    const plant = repo.archivePlant(data, parseInt(req.params.id, 10));
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    writeData(data);
    res.json(plant);
  }));

  // DELETE /plants/:id – hard delete plant + cascade logs & schedules.
  app.delete('/plants/:id', handle((req, res) => {
    const data = readData();
    const result = repo.deletePlantCascade(data, parseInt(req.params.id, 10));
    if (!result) return res.status(404).json({ error: 'Plant not found' });
    writeData(data);
    res.json({
      message: `Deleted plant "${result.plant.name}" and ${result.deletedLogs} logs`,
      deletedLogs: result.deletedLogs,
    });
  }));

  /* ---------------------------- Logs ---------------------------- */

  // GET /logs – all logs, newest first; optional ?plant_id= filter.
  app.get('/logs', handle((req, res) => {
    const data = readData();
    res.json(repo.listLogs(data, { plant_id: req.query.plant_id }));
  }));

  // GET /logs/export – CSV download (includes measurement columns).
  app.get('/logs/export', handle((req, res) => {
    const data = readData();
    const fields = [
      'id', 'plant_id', 'plant_name', 'date', 'height', 'height_unit', 'growth_stage',
      'ph', 'ec', 'ppm', 'water_temp', 'air_temp', 'temp_unit', 'humidity',
      'light_hours', 'reservoir_volume', 'nutrients', 'notes', 'created_at',
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(data.logs);
    res.header('Content-Type', 'text/csv');
    res.attachment(`hydro_logs_${Date.now()}.csv`);
    res.send(csv);
  }));

  // POST /logs – create a log, with optional image upload.
  app.post('/logs', upload.single('image'), handle((req, res) => {
    const errors = validateLog(req.body, { requireDate: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (unknownPlantId(data, req.body)) return res.status(404).json({ error: 'Plant not found' });
    const body = { ...req.body, image_url: req.file ? `/uploads/${req.file.filename}` : null };
    const log = repo.createLog(data, body);
    writeData(data);
    res.status(201).json(log);
  }));

  // PUT /logs/:id – update a log (date and image are preserved).
  app.put('/logs/:id', handle((req, res) => {
    const errors = validateLog(req.body, { requireDate: false });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (unknownPlantId(data, req.body)) return res.status(404).json({ error: 'Plant not found' });
    const log = repo.updateLog(data, parseInt(req.params.id, 10), req.body);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    writeData(data);
    res.json(log);
  }));

  // DELETE /logs/plant/:plantName – delete all logs for a plant name.
  // Deprecated: prefer DELETE /plants/:id. Kept as a thin alias during the
  // transition so older clients keep working.
  app.delete('/logs/plant/:plantName', handle((req, res) => {
    const plantName = decodeURIComponent(req.params.plantName);
    const data = readData();
    const deletedCount = repo.deleteLogsByPlantName(data, plantName);
    writeData(data);
    res.json({ message: `Deleted ${deletedCount} logs for plant "${plantName}"`, deletedCount });
  }));

  // DELETE /logs/:id – delete a single log.
  app.delete('/logs/:id', handle((req, res) => {
    const data = readData();
    const deleted = repo.deleteLog(data, parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Log not found' });
    writeData(data);
    res.json({ message: `Successfully deleted log with ID: ${deleted.id}`, deletedLog: deleted });
  }));

  /* -------------------------- Feeding --------------------------- */

  // GET /feeding – all saved feeding schedules.
  app.get('/feeding', handle((_req, res) => {
    const data = readData();
    res.json(repo.listSchedules(data));
  }));

  // POST /feeding – create a feeding schedule.
  app.post('/feeding', handle((req, res) => {
    const errors = validateSchedule(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (unknownPlantId(data, req.body)) return res.status(404).json({ error: 'Plant not found' });
    const schedule = repo.createSchedule(data, req.body);
    writeData(data);
    res.status(201).json(schedule);
  }));

  // PUT /feeding/:id – edit a feeding schedule.
  app.put('/feeding/:id', handle((req, res) => {
    const errors = validateSchedule(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (unknownPlantId(data, req.body)) return res.status(404).json({ error: 'Plant not found' });
    const schedule = repo.updateSchedule(data, parseInt(req.params.id, 10), req.body);
    if (!schedule) return res.status(404).json({ error: 'Feeding schedule not found' });
    writeData(data);
    res.json(schedule);
  }));

  // POST /feeding/:id/fed – mark a schedule as fed now (drives reminders).
  app.post('/feeding/:id/fed', handle((req, res) => {
    const data = readData();
    const schedule = repo.markFed(data, parseInt(req.params.id, 10));
    if (!schedule) return res.status(404).json({ error: 'Feeding schedule not found' });
    writeData(data);
    res.json(schedule);
  }));

  // DELETE /feeding/:id – delete a feeding schedule.
  app.delete('/feeding/:id', handle((req, res) => {
    const data = readData();
    const deleted = repo.deleteSchedule(data, parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Feeding schedule not found' });
    writeData(data);
    res.json({ message: `Deleted feeding schedule ${deleted.id}`, deleted });
  }));

  /* -------------------------- Settings -------------------------- */

  // GET /settings – app settings (units, ppm scale, default species).
  app.get('/settings', handle((_req, res) => {
    const data = readData();
    res.json(repo.getSettings(data));
  }));

  // PUT /settings – merge a settings patch (enums clamped).
  app.put('/settings', handle((req, res) => {
    const data = readData();
    const settings = repo.updateSettings(data, req.body);
    writeData(data);
    res.json(settings);
  }));

  /* -------------------------- Backup ---------------------------- */

  // GET /backup – download the entire data store (plants, logs, schedules,
  // settings) as a single JSON file for safe-keeping or transfer. Photos live
  // as separate files under uploads/ and are NOT included in this snapshot.
  app.get('/backup', handle((_req, res) => {
    const payload = {
      _type: BACKUP_TYPE,
      _version: 1,
      exportedAt: new Date().toISOString(),
      data: readData(),
    };
    res.header('Content-Type', 'application/json');
    res.attachment(`hydro_backup_${new Date().toISOString().slice(0, 10)}.json`);
    res.send(JSON.stringify(payload, null, 2));
  }));

  // POST /backup/restore – REPLACE the entire store with an uploaded backup.
  // Destructive by design. Accepts our own envelope or a bare data object, and
  // upgrades an older-schema backup on the way in. Ids are rebuilt so a restore
  // can never collide with future inserts.
  app.post('/backup/restore', handle((req, res) => {
    const body = req.body || {};
    const raw = body._type === BACKUP_TYPE ? body.data : body;
    if (!raw || typeof raw !== 'object' || (!Array.isArray(raw.plants) && !Array.isArray(raw.logs))) {
      return res.status(400).json({ error: 'This does not look like a Hydro backup file.' });
    }
    const data = repo.prepareImport(migrateData(raw).data);
    writeData(data);
    res.json({
      message: 'Backup restored',
      counts: { plants: data.plants.length, logs: data.logs.length, schedules: data.schedules.length },
    });
  }));

  // Multer / upload errors land here as JSON instead of an HTML stack trace.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('Backend error:', err.message);
    res.status(400).json({ error: err.message || 'Something went wrong' });
  });

  return app;
}

// Convenience helper used by the Electron main process.
// Start the backend on the loopback interface only. `port` defaults to 0 (the
// OS picks a free one: a fixed 5000 collided with macOS AirPlay). Resolves to
// { httpServer, state, port, apiBase }; `state.damaged` is set when the data
// file could not be read, so the shell can tell the user before they touch
// anything.
export function startServer({ dataFile, uploadsDir, port = 0, host = '127.0.0.1', token = null, allowedOrigins }) {
  const app = createServer({ dataFile, uploadsDir, token, allowedOrigins });
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      const actual = httpServer.address().port;
      console.log(`Embedded backend running on http://${host}:${actual} (JSON storage)`);
      resolve({ httpServer, state: app.hydroState, port: actual, apiBase: `http://${host}:${actual}` });
    });
    httpServer.on('error', reject);
  });
}
