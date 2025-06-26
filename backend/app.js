import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import feedingRoutes from './routes/feeding.routes.js';
import logsRoutes from './routes/logs.routes.js'; // <-- Added import
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Basic express setup
const app = express();
app.use(express.json());
app.use(cors());

// Setup for static images
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static('uploads'));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
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

app.use('/feeding', feedingRoutes);
app.use('/logs', logsRoutes); // <-- Added logs route

// Error handling middleware (should be after all routes)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

