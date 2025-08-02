import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database with enhanced configuration
const initDatabase = async () => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'hydro-growth-tracker.db');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys and optimize performance
  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec('PRAGMA journal_mode = WAL');
  await db.exec('PRAGMA synchronous = NORMAL');
  await db.exec('PRAGMA cache_size = 1000');
  await db.exec('PRAGMA temp_store = MEMORY');

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_name TEXT NOT NULL,
      date TEXT NOT NULL,
      height REAL NOT NULL CHECK (height >= 0),
      nutrients TEXT NOT NULL,
      notes TEXT DEFAULT '',
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS feeding_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_name TEXT NOT NULL,
      feeding_type TEXT NOT NULL,
      schedule_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create triggers for updated_at timestamps
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_logs_timestamp 
    AFTER UPDATE ON logs
    BEGIN
      UPDATE logs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_feeding_schedules_timestamp 
    AFTER UPDATE ON feeding_schedules
    BEGIN
      UPDATE feeding_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  console.log('SQLite database initialized successfully');
  return db;
};

// Initialize database on startup and run migrations
const db = await initDatabase();

// Import and run migrations after db is initialized
const { runMigrations } = await import('./migrations.js');
await runMigrations(db);

export default db;
