// backend/routes/logs.routes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database/db.js';
import { Parser } from 'json2csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage });

/* -----------------------------------------------------------
   1. GET /logs  – return JSON array                        */
router.get('/', async (_req, res) => {
  try {
    const rows = await db.all('SELECT * FROM logs ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/* -----------------------------------------------------------
   2. POST /logs – insert new log                           */
router.post('/', upload.single('image'), async (req, res) => {
  console.log('Received POST /logs', req.body);
  try {
    const { plant_name, date, height, nutrients, notes } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await db.run(
      'INSERT INTO logs (plant_name, date, height, nutrients, notes, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [plant_name, date, height, nutrients, notes, image_url]
    );
    
    // Get the inserted row
    const insertedRow = await db.get('SELECT * FROM logs WHERE id = ?', [result.lastID]);
    res.status(201).json(insertedRow);
  } catch (err) {
    console.error('Error adding log:', err);
    res.status(500).json({ error: 'Failed to add log' });
  }
});

/* -----------------------------------------------------------
   3. GET /logs/export  – return text/csv                   */
router.get('/export', async (_req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, plant_name, height, nutrients, notes, created_at
       FROM logs ORDER BY created_at DESC`
    );

    const parser = new Parser({
      fields: ['id', 'plant_name', 'height', 'nutrients', 'notes', 'created_at'],
    });
    const csv = parser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment(`hydro_logs_${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting logs:', err);
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

/* -----------------------------------------------------------
   4. PUT /logs/:id – update a specific log                */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { plant_name, height, nutrients, notes } = req.body;
    
    const result = await db.run(
      'UPDATE logs SET plant_name = ?, height = ?, nutrients = ?, notes = ? WHERE id = ?',
      [plant_name, height, nutrients, notes, id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    // Get the updated row
    const updatedRow = await db.get('SELECT * FROM logs WHERE id = ?', [id]);
    res.json(updatedRow);
  } catch (err) {
    console.error('Error updating log:', err);
    res.status(500).json({ error: 'Failed to update log', details: err.message });
  }
});

/* -----------------------------------------------------------
   5. DELETE /logs/:id – delete a specific log             */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the log before deleting
    const logToDelete = await db.get('SELECT * FROM logs WHERE id = ?', [id]);
    
    if (!logToDelete) {
      return res.status(404).json({ error: 'Log not found' });
    }
    
    const result = await db.run('DELETE FROM logs WHERE id = ?', [id]);
    
    res.json({ 
      message: `Successfully deleted log with ID: ${id}`,
      deletedLog: logToDelete
    });
  } catch (err) {
    console.error('Error deleting log:', err);
    res.status(500).json({ error: 'Failed to delete log', details: err.message });
  }
});

/* -----------------------------------------------------------
   6. DELETE /logs/plant/:plantName – delete all logs for a specific plant */
router.delete('/plant/:plantName', async (req, res) => {
  try {
    const { plantName } = req.params;
    const decodedPlantName = decodeURIComponent(plantName);
    
    console.log(`Attempting to delete plant: ${decodedPlantName}`);
    
    // Delete all logs for this plant
    const result = await db.run(
      'DELETE FROM logs WHERE plant_name = ?',
      [decodedPlantName]
    );
    
    console.log(`Deleted ${result.changes} logs for plant: ${decodedPlantName}`);
    
    res.json({ 
      message: `Deleted ${result.changes} logs for plant: ${decodedPlantName}`,
      deletedCount: result.changes
    });
  } catch (err) {
    console.error('Error deleting plant logs:', err);
    res.status(500).json({ error: 'Failed to delete plant logs', details: err.message });
  }
});

// Serve uploaded images statically
// (This should also be in your app.js)
export default router;
