// backend/routes/logs.routes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../database/db.js';
import { Parser } from 'json2csv';

const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join('uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage });

/* -----------------------------------------------------------
   1. GET /logs  – return JSON array                        */
router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM logs ORDER BY created_at DESC');
  res.json(rows);
});

/* -----------------------------------------------------------
   2. POST /logs – insert new log                           */
router.post('/', upload.single('image'), async (req, res) => {
  console.log('Received POST /logs', req.body);
  try {
    const { plant_name, date, height, nutrients, notes } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      'INSERT INTO logs (plant_name, date, height, nutrients, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [plant_name, date, height, nutrients, notes, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add log' });
  }
});

/* -----------------------------------------------------------
   3. GET /logs/export  – return text/csv                   */
router.get('/export', async (_req, res) => {
  const { rows } = await pool.query(
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
});

// Serve uploaded images statically
// (This should also be in your app.js)
export default router;
