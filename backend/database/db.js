import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const initDatabase = async () => {
  const db = await open({
    filename: path.join(__dirname, 'hydro-growth-tracker.db'),
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_name TEXT NOT NULL,
      date TEXT NOT NULL,
      height REAL NOT NULL,
      nutrients TEXT,
      notes TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS feeding_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_name TEXT NOT NULL,
      feeding_type TEXT NOT NULL,
      schedule_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('SQLite database initialized successfully');
  return db;
};

// Initialize database on startup
const db = await initDatabase();

export default db;
