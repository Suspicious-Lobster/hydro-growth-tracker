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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
try {
  await fs.access(uploadsDir);
} catch (error) {
  await fs.mkdir(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Middleware
app.use(express.json());
app.use(cors());

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

