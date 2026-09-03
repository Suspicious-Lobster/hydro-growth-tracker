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
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';

import * as repo from './db/repository.js';
import { runMigration, migrateData, SchemaTooNewError } from './db/migrate.js';
import { validateLog, validatePlant, validateSchedule, validateReservoirEvent } from './validation.js';
import { nullLogger } from './logger.js';

// Marker embedded in exported backups so a restore can recognize its own files
// (and reject an unrelated JSON) before replacing the store.
const BACKUP_TYPE = 'hydro-growth-tracker-backup';

// Magic-byte sniffers for the image formats the app accepts. Multer's
// fileFilter only trusts the client-supplied mimetype, which a request can
// lie about (probe P6, 2026-09-02: a file named evil.html sent as
// mimetype: image/png was stored and served as-is). This is the real check:
// it looks at the bytes actually written to disk and returns the extension
// they justify, or null when none match.
export function sniffImageExt(buf) {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// Prefix a leading =, +, -, @, tab or carriage-return with a single quote so
// spreadsheet apps display the cell as text instead of evaluating it as a
// formula (probe P7, 2026-09-02: an exported nutrients value of
// =HYPERLINK("http://evil","click") ran on open in Excel). Non-string values
// (numbers, null) pass through untouched.
// Windows can still hold a just-written upload open (multer's stream, an
// antivirus scan) for a moment; unlinkSync then fails with EPERM/EBUSY. Retry
// briefly, then log: the row is already gone, so this is never fatal. Seen
// once in a full parallel test run (1 of ~6) and never alone, 2026-09-02;
// again 1 of 4 full runs on 2026-09-03 with a 5-attempt / 300 ms budget, so
// the budget is now 8 attempts (about 720 ms) -- still never alone.
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const UNLINK_ATTEMPTS = 8;
function unlinkWithRetry(filePath, what) {
  for (let attempt = 1; attempt <= UNLINK_ATTEMPTS; attempt += 1) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt === UNLINK_ATTEMPTS) {
        console.error(`Failed to remove ${what}:`, error.message);
        return false;
      }
      sleepMs(20 * attempt);
    }
  }
  return false;
}

export function csvSafe(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// One CSV cell for a log's structured doses (MR-37): "Part A 2 ml/L; Part B
// 1 ml/L", or '' when there are none.
export function formatDosesCell(doses) {
  if (!Array.isArray(doses) || doses.length === 0) return '';
  return doses.map((d) => `${d.name} ${d.ml_per_l} ml/L`).join('; ');
}

// Names a zip-backup upload entry may carry: a flat file directly under
// uploads/, made of the characters finalizeUpload() ever produces plus the
// legacy sanitized set. Anything else (a directory, '..', an absolute path,
// a drive letter) is refused before any byte is written (MR-54).
const ZIP_UPLOAD_ENTRY = /^uploads\/[A-Za-z0-9._-]{1,120}$/;
export const ZIP_BACKUP_JSON = 'backup.json';
export const ZIP_MAX_BYTES = 50 * 1024 * 1024;

// Validate a zip backup's entries without writing anything. Returns
// { envelope, images: [{ name, bytes }] } or throws an Error whose message
// is safe to send back as a 400.
export function readZipBackup(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new Error('This does not look like a zip file.');
  }
  const entries = zip.getEntries();
  const json = entries.find((e) => e.entryName === ZIP_BACKUP_JSON);
  if (!json) throw new Error(`This zip has no ${ZIP_BACKUP_JSON}; it is not a Hydro backup.`);
  let envelope;
  try {
    envelope = JSON.parse(json.getData().toString('utf8'));
  } catch {
    throw new Error(`${ZIP_BACKUP_JSON} inside the zip is not valid JSON.`);
  }
  if (!envelope || envelope._type !== BACKUP_TYPE || !envelope.data || typeof envelope.data !== 'object') {
    throw new Error('This does not look like a Hydro backup file.');
  }
  const images = [];
  for (const e of entries) {
    if (e === json || e.isDirectory) continue;
    if (!ZIP_UPLOAD_ENTRY.test(e.entryName)) {
      throw new Error(`Refusing zip entry "${e.entryName}": only flat files under uploads/ are allowed.`);
    }
    const bytes = e.getData();
    if (!sniffImageExt(bytes.subarray(0, 12))) {
      throw new Error(`Refusing zip entry "${e.entryName}": not a PNG, JPEG, GIF or WebP image.`);
    }
    images.push({ name: path.posix.basename(e.entryName), bytes });
  }
  return { envelope, images };
}

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
// `backupsDir`: where the once-a-day copies of the data file go (14 kept);
// defaults to a backups/ folder beside the data file.
export function createServer({ dataFile, uploadsDir, backupsDir = null, token = null, allowedOrigins = DEFAULT_ALLOWED_ORIGINS, logger = nullLogger }) {
  backupsDir = backupsDir || path.join(path.dirname(dataFile), 'backups');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  let migration = { migrated: false };
  if (!fs.existsSync(dataFile)) {
    repo.save(dataFile, repo.emptyData());
  } else {
    // A migration failure (e.g. a read-only/full data dir) must not brick the
    // app: log it and serve the existing data rather than aborting startup.
    try {
      migration = runMigration(dataFile);
    } catch (error) {
      logger.error('Data migration failed; serving existing data as-is:', { message: error.message });
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

  // A file from a NEWER schema parses fine but must not be served: normalize()
  // would silently drop every field the newer version added (probe P4). It is
  // left untouched on disk and reported through the same damaged state, with
  // no salvage copy because the file itself is intact.
  if (migration.tooNew) {
    const tooNew = new SchemaTooNewError(migration.found);
    state.damaged = {
      error: tooNew.message,
      dataFile,
      salvagePath: null,
      tooNew: true,
      detail: `schemaVersion ${migration.found} > supported ${repo.SCHEMA_VERSION}`,
    };
  }

  const refuse = () => new repo.DamagedDataFileError(dataFile, state.damaged.salvagePath, new Error(state.damaged.error));
  const readData = () => {
    if (state.damaged) throw refuse();
    return repo.load(dataFile);
  };
  const writeData = (data) => {
    if (state.damaged) throw refuse();
    repo.save(dataFile, data);
    // The daily copy is the recovery path for a damaged store; it must never
    // turn a successful save into a failure.
    try { repo.dailyBackup(dataFile, backupsDir); } catch (error) { logger.error('Daily backup failed:', { message: error.message }); }
  };
  // Take today's copy at startup too, so a day with no edits still has one.
  if (!state.damaged) {
    try { repo.dailyBackup(dataFile, backupsDir); } catch (error) { logger.error('Daily backup failed:', { message: error.message }); }
  }

  // Probe once at startup so the shell can warn immediately; a file that goes
  // bad later is caught per request by handle(). Skipped when the too-new
  // check above has already set the state (readData() would just re-throw it).
  if (!state.damaged) {
    try {
      readData();
    } catch (error) {
      if (error instanceof repo.DamagedDataFileError) markDamaged(error);
      else throw error;
    }
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

  // multer trusts the client-supplied mimetype (fileFilter above), which is
  // exactly what a request can lie about. This is the real check: read the
  // bytes multer just wrote, confirm they match a real image's magic number,
  // and rename to a fresh random name so the multer temp name (which can
  // still carry an attacker-chosen extension like .html) never reaches the
  // stored URL. Returns the final filename, or null (having removed the
  // file) when the bytes do not match any accepted format.
  const finalizeUpload = (file) => {
    const head = Buffer.alloc(12);
    const fd = fs.openSync(file.path, 'r');
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(fd, head, 0, 12, 0);
    } finally {
      fs.closeSync(fd);
    }
    const ext = sniffImageExt(head.subarray(0, bytesRead));
    if (!ext) {
      unlinkWithRetry(file.path, 'invalid upload');
      return null;
    }
    const finalName = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    fs.renameSync(file.path, path.join(uploadsDir, finalName));
    return finalName;
  };

  // Best-effort removal of an uploaded image by its stored /uploads/... URL.
  // path.basename strips any directory component so a crafted image_url can
  // never escape uploadsDir; failures are logged, never fatal (the log/plant
  // row is already gone by the time this runs).
  const removeUploadedImage = (imageUrl) => {
    if (!imageUrl) return;
    const filePath = path.join(uploadsDir, path.basename(imageUrl));
    unlinkWithRetry(filePath, 'uploaded image');
  };

  // Small wrapper so each handler gets fresh data and a uniform 500 on throw.
  const handle = (fn) => (req, res) => {
    try {
      fn(req, res);
    } catch (error) {
      if (error instanceof repo.DamagedDataFileError) {
        const d = state.damaged || markDamaged(error);
        return res.status(503).json({ error: d.error, damaged: d });
      }
      logger.error(`Error handling ${req.method} ${req.path}`, { message: error.message, stack: error.stack });
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
    if (repo.findPlantByName(data, req.body.name, { activeOnly: true })) {
      return res.status(409).json({ error: 'A plant with this name already exists' });
    }
    const plant = repo.createPlant(data, req.body);
    writeData(data);
    res.status(201).json(plant);
  }));

  // PUT /plants/:id – partial update; renaming cascades to logs & schedules.
  // Un-archiving through this route is checked for a name clash exactly like
  // POST /plants/:id/restore.
  app.put('/plants/:id', handle((req, res) => {
    const errors = validatePlant(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    const id = parseInt(req.params.id, 10);
    const target = repo.getPlant(data, id);
    if (!target) return res.status(404).json({ error: 'Plant not found' });
    const nextName = req.body.name !== undefined ? String(req.body.name).trim() : target.name;
    const willBeActive = req.body.archived !== undefined ? !req.body.archived : !target.archived;
    if (willBeActive) {
      const existing = repo.findPlantByName(data, nextName, { activeOnly: true });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: 'A plant with this name already exists' });
      }
    }
    const plant = repo.updatePlant(data, id, req.body);
    writeData(data);
    res.json(plant);
  }));

  // POST /plants/:id/restore – un-archive; 409 if an active plant has the name.
  app.post('/plants/:id/restore', handle((req, res) => {
    const data = readData();
    const result = repo.restorePlant(data, parseInt(req.params.id, 10));
    if (!result) return res.status(404).json({ error: 'Plant not found' });
    if (result.clash) {
      return res.status(409).json({ error: `An active plant is already named "${result.clash.name}". Rename one of them first.` });
    }
    writeData(data);
    res.json(result.plant);
  }));

  // POST /plants/:id/archive – soft delete (keeps logs).
  app.post('/plants/:id/archive', handle((req, res) => {
    const data = readData();
    const plant = repo.archivePlant(data, parseInt(req.params.id, 10));
    if (!plant) return res.status(404).json({ error: 'Plant not found' });
    writeData(data);
    res.json(plant);
  }));

  // DELETE /plants/:id – hard delete plant + cascade logs & schedules, and
  // every image file those logs held.
  app.delete('/plants/:id', handle((req, res) => {
    const data = readData();
    const result = repo.deletePlantCascade(data, parseInt(req.params.id, 10));
    if (!result) return res.status(404).json({ error: 'Plant not found' });
    writeData(data);
    for (const imageUrl of result.imageUrls) removeUploadedImage(imageUrl);
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
      'light_hours', 'reservoir_volume', 'nutrients', 'doses', 'notes', 'created_at',
    ];
    // Neutralise formula-injection cells (probe P7) before handing rows to
    // json2csv, and prefix a UTF-8 BOM so Excel reads non-ASCII notes/plant
    // names correctly instead of guessing an encoding. Structured doses are
    // flattened to one text cell: "Part A 2 ml/L; Part B 1 ml/L".
    const rows = data.logs.map((log) => {
      const row = {};
      for (const f of fields) row[f] = csvSafe(log[f]);
      row.doses = csvSafe(formatDosesCell(log.doses));
      return row;
    });
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`hydro_logs_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  }));

  // POST /logs – create a log, with optional image upload.
  app.post('/logs', upload.single('image'), handle((req, res) => {
    let imageFilename = null;
    if (req.file) {
      imageFilename = finalizeUpload(req.file);
      if (!imageFilename) return res.status(400).json({ error: 'Invalid image file' });
    }
    const errors = validateLog(req.body, { requireDate: true });
    if (errors.length > 0) {
      if (imageFilename) removeUploadedImage(`/uploads/${imageFilename}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (unknownPlantId(data, req.body)) {
      if (imageFilename) removeUploadedImage(`/uploads/${imageFilename}`);
      return res.status(404).json({ error: 'Plant not found' });
    }
    const body = { ...req.body, image_url: imageFilename ? `/uploads/${imageFilename}` : null };
    const log = repo.createLog(data, body);
    writeData(data);
    res.status(201).json(log);
  }));

  // PUT /logs/:id – update a log. The date is preserved unless sent; the
  // image is preserved unless a new one arrives as multipart `image` (MR-37),
  // in which case the bytes are sniffed exactly like POST and the previous
  // file is removed once the new URL is stored. multer passes a JSON body
  // straight through, so the plain edit path is unchanged.
  app.put('/logs/:id', upload.single('image'), handle((req, res) => {
    let imageFilename = null;
    if (req.file) {
      imageFilename = finalizeUpload(req.file);
      if (!imageFilename) return res.status(400).json({ error: 'Invalid image file' });
    }
    const discardNew = () => { if (imageFilename) removeUploadedImage(`/uploads/${imageFilename}`); };
    const errors = validateLog(req.body, { requireDate: false });
    if (errors.length > 0) {
      discardNew();
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (unknownPlantId(data, req.body)) { discardNew(); return res.status(404).json({ error: 'Plant not found' }); }
    const existing = repo.getLog(data, parseInt(req.params.id, 10));
    if (!existing) { discardNew(); return res.status(404).json({ error: 'Log not found' }); }
    const previousImage = existing.image_url;
    const body = imageFilename ? { ...req.body, image_url: `/uploads/${imageFilename}` } : req.body;
    const log = repo.updateLog(data, existing.id, body);
    writeData(data);
    if (imageFilename && previousImage && previousImage !== log.image_url) removeUploadedImage(previousImage);
    res.json(log);
  }));

  // DELETE /logs/:id – delete a single log, and its image file if it had one.
  app.delete('/logs/:id', handle((req, res) => {
    const data = readData();
    const deleted = repo.deleteLog(data, parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Log not found' });
    writeData(data);
    removeUploadedImage(deleted.image_url);
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

  /* ----------------------- Reservoir events ---------------------- */

  // GET /reservoir – water changes and top-offs, newest first; ?plant_id=.
  app.get('/reservoir', handle((req, res) => {
    const data = readData();
    res.json(repo.listReservoirEvents(data, { plant_id: req.query.plant_id }));
  }));

  // POST /reservoir – record a change or top-off for a plant (by plant_id).
  app.post('/reservoir', handle((req, res) => {
    const errors = validateReservoirEvent(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    const event = repo.createReservoirEvent(data, req.body);
    if (!event) return res.status(404).json({ error: 'Plant not found' });
    writeData(data);
    res.status(201).json(event);
  }));

  // PUT /reservoir/:id – partial update.
  app.put('/reservoir/:id', handle((req, res) => {
    const errors = validateReservoirEvent(req.body, { partial: true });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    const data = readData();
    if (unknownPlantId(data, req.body)) return res.status(404).json({ error: 'Plant not found' });
    const event = repo.updateReservoirEvent(data, parseInt(req.params.id, 10), req.body);
    if (!event) return res.status(404).json({ error: 'Reservoir event not found' });
    writeData(data);
    res.json(event);
  }));

  // DELETE /reservoir/:id
  app.delete('/reservoir/:id', handle((req, res) => {
    const data = readData();
    const deleted = repo.deleteReservoirEvent(data, parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Reservoir event not found' });
    writeData(data);
    res.json({ message: `Deleted reservoir event ${deleted.id}`, deleted });
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
    const payload = backupEnvelope(readData());
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
    let migrated;
    try {
      migrated = migrateData(raw);
    } catch (error) {
      if (error instanceof SchemaTooNewError) {
        return res.status(400).json({ error: `This backup ${error.message.slice('This data '.length)}` });
      }
      throw error;
    }
    const data = repo.prepareImport(migrated.data);
    // Destructive by design, so the current store is snapshotted first
    // (hydro-data.pre-restore-<ts>.json, newest 5 kept).
    if (state.damaged) throw refuse();
    const snapshotPath = repo.snapshot(dataFile, 'pre-restore', 5);
    writeData(data);
    res.json({
      message: 'Backup restored',
      counts: { plants: data.plants.length, logs: data.logs.length, schedules: data.schedules.length },
      previousStoreSavedAs: snapshotPath,
    });
  }));

  /* ------------------------ Backup with photos ------------------------ */

  // The JSON envelope GET /backup sends, built once here so the zip carries
  // byte-identical content.
  const backupEnvelope = (data) => ({
    _type: BACKUP_TYPE,
    _version: 1,
    exportedAt: new Date().toISOString(),
    data,
  });

  // GET /backup/zip – the same envelope as backup.json plus uploads/<file>
  // for every image a log references (missing files are skipped, not fatal:
  // the JSON is still the complete store).
  app.get('/backup/zip', handle((_req, res) => {
    const data = readData();
    const zip = new AdmZip();
    zip.addFile(ZIP_BACKUP_JSON, Buffer.from(JSON.stringify(backupEnvelope(data), null, 2), 'utf8'));
    const seen = new Set();
    for (const log of data.logs) {
      if (!log.image_url) continue;
      const name = path.basename(log.image_url);
      if (seen.has(name)) continue;
      seen.add(name);
      const filePath = path.join(uploadsDir, name);
      if (fs.existsSync(filePath)) zip.addFile(`uploads/${name}`, fs.readFileSync(filePath));
    }
    res.header('Content-Type', 'application/zip');
    res.attachment(`hydro_backup_${new Date().toISOString().slice(0, 10)}.zip`);
    res.send(zip.toBuffer());
  }));

  // POST /backup/restore/zip – multipart field `archive`. Every entry is
  // validated (envelope shape, flat upload names, real image bytes) BEFORE
  // the store is touched; then the same migrate / prepareImport / snapshot
  // path as the JSON restore, and the images are written after the save.
  // Existing upload files are left alone (an orphan is harmless; a deleted
  // photo is not).
  const zipUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ZIP_MAX_BYTES, files: 1 } });
  app.post('/backup/restore/zip', zipUpload.single('archive'), handle((req, res) => {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No zip file was uploaded.' });
    let parsed;
    try {
      parsed = readZipBackup(req.file.buffer);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const raw = parsed.envelope.data;
    if (!Array.isArray(raw.plants) && !Array.isArray(raw.logs)) {
      return res.status(400).json({ error: 'This does not look like a Hydro backup file.' });
    }
    let migrated;
    try {
      migrated = migrateData(raw);
    } catch (error) {
      if (error instanceof SchemaTooNewError) {
        return res.status(400).json({ error: `This backup ${error.message.slice('This data '.length)}` });
      }
      throw error;
    }
    const data = repo.prepareImport(migrated.data);
    if (state.damaged) throw refuse();
    const snapshotPath = repo.snapshot(dataFile, 'pre-restore', 5);
    writeData(data);
    let photos = 0;
    for (const img of parsed.images) {
      try {
        fs.writeFileSync(path.join(uploadsDir, img.name), img.bytes);
        photos += 1;
      } catch (error) {
        logger.error('Failed to write a restored photo:', { name: img.name, message: error.message });
      }
    }
    res.json({
      message: 'Backup restored',
      counts: { plants: data.plants.length, logs: data.logs.length, schedules: data.schedules.length, photos },
      previousStoreSavedAs: snapshotPath,
    });
  }));

  // Multer / upload errors land here as JSON instead of an HTML stack trace.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error('Backend error:', { message: err.message });
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
export function startServer({ dataFile, uploadsDir, backupsDir = null, port = 0, host = '127.0.0.1', token = null, allowedOrigins, logger = nullLogger }) {
  const app = createServer({ dataFile, uploadsDir, backupsDir, token, allowedOrigins, logger });
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      const actual = httpServer.address().port;
      logger.info(`Embedded backend running on http://${host}:${actual} (JSON storage)`);
      resolve({ httpServer, state: app.hydroState, port: actual, apiBase: `http://${host}:${actual}` });
    });
    httpServer.on('error', reject);
  });
}
