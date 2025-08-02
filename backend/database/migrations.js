// backend/database/migrations.js

const migrations = [
  {
    version: 1,
    description: 'Add date index to logs table',
    sql: `CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);`
  },
  {
    version: 2,
    description: 'Add plant_name index to logs table',
    sql: `CREATE INDEX IF NOT EXISTS idx_logs_plant_name ON logs(plant_name);`
  },
  {
    version: 3,
    description: 'Add created_at index to logs table',
    sql: `CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);`
  },
  {
    version: 4,
    description: 'Add backup logs table for data recovery',
    sql: `CREATE TABLE IF NOT EXISTS logs_backup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_id INTEGER,
      plant_name TEXT,
      date TEXT,
      height REAL,
      nutrients TEXT,
      notes TEXT,
      image_url TEXT,
      created_at DATETIME,
      backup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      backup_reason TEXT
    );`
  }
];

export const runMigrations = async (database) => {
  try {
    // Create migrations table if it doesn't exist
    await database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get applied migrations
    const appliedMigrations = await database.all('SELECT version FROM schema_migrations');
    const appliedVersions = appliedMigrations.map(m => m.version);

    // Run pending migrations
    for (const migration of migrations) {
      if (!appliedVersions.includes(migration.version)) {
        console.log(`Running migration ${migration.version}: ${migration.description}`);
        await database.exec(migration.sql);
        await database.run(
          'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
          [migration.version, migration.description]
        );
        console.log(`✅ Migration ${migration.version} completed`);
      }
    }

    console.log('✅ All database migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

export const createBackup = async (database, reason = 'Manual backup') => {
  try {
    const logs = await database.all('SELECT * FROM logs');
    
    for (const log of logs) {
      await database.run(
        `INSERT INTO logs_backup 
         (original_id, plant_name, date, height, nutrients, notes, image_url, created_at, backup_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [log.id, log.plant_name, log.date, log.height, log.nutrients, log.notes, log.image_url, log.created_at, reason]
      );
    }
    
    console.log(`✅ Database backup created: ${logs.length} records backed up`);
    return { success: true, recordsBackedUp: logs.length };
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
};
