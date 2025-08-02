import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import feedingRoutes from './routes/feeding.routes.js';
import logsRoutes from './routes/logs.routes.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables with defaults
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const UPLOAD_LIMIT = process.env.UPLOAD_LIMIT || '10mb';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
try {
  await fs.access(uploadsDir);
} catch (error) {
  await fs.mkdir(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Enhanced middleware with security
app.use(express.json({ limit: UPLOAD_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: UPLOAD_LIMIT }));

// CORS configuration
app.use(cors({
  origin: NODE_ENV === 'production' ? false : CORS_ORIGIN,
  credentials: true
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static uploads with proper headers
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, path) => {
    if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.gif')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Image upload route
app.post('/logs/images', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  res.json({
    imageUrl: `/uploads/${req.file.filename}`,
  });
});

// API Routes
app.use('/feeding', feedingRoutes);
app.use('/logs', logsRoutes);

// Serve frontend in production
if (process.env.NODE_ENV !== 'development') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});

