#!/usr/bin/env node

/**
 * Installation Setup Script for Hydro Growth Tracker
 * This script ensures the application is properly configured for offline use
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

console.log('🌿 Hydro Growth Tracker - Installation Setup');
console.log('===========================================');

// Create necessary directories
const createDirectories = async () => {
  const dirs = [
    path.join(projectRoot, 'backend', 'uploads'),
    path.join(projectRoot, 'backend', 'database')
  ];

  for (const dir of dirs) {
    try {
      await fs.access(dir);
      console.log(`✅ Directory exists: ${dir}`);
    } catch (error) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  }
};

// Install dependencies
const installDependencies = async () => {
  console.log('\n📦 Installing dependencies...');
  
  // Install backend dependencies
  console.log('Installing backend dependencies...');
  const backendInstall = spawn('npm', ['install'], {
    cwd: path.join(projectRoot, 'backend'),
    stdio: 'inherit',
    shell: true
  });

  await new Promise((resolve, reject) => {
    backendInstall.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Backend dependencies installed');
        resolve();
      } else {
        reject(new Error(`Backend install failed with code ${code}`));
      }
    });
  });

  // Install frontend dependencies
  console.log('Installing frontend dependencies...');
  const frontendInstall = spawn('npm', ['install'], {
    cwd: path.join(projectRoot, 'frontend'),
    stdio: 'inherit',
    shell: true
  });

  await new Promise((resolve, reject) => {
    frontendInstall.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Frontend dependencies installed');
        resolve();
      } else {
        reject(new Error(`Frontend install failed with code ${code}`));
      }
    });
  });
};

// Test database initialization
const testDatabase = async () => {
  console.log('\n🗄️  Testing database initialization...');
  
  // Import and test database
  const dbPath = path.join(projectRoot, 'backend', 'database', 'db.js');
  try {
    const { default: db } = await import(dbPath);
    
    // Test basic database operations
    await db.run('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log(`✅ Database tables: ${tables.map(t => t.name).join(', ')}`);
    
    // Test a simple insert and select
    await db.run('INSERT OR IGNORE INTO logs (plant_name, date, height, nutrients, notes) VALUES (?, ?, ?, ?, ?)',
      ['Test Plant', new Date().toISOString(), 10.5, 'Test nutrients', 'Installation test']);
    
    const testRows = await db.all('SELECT * FROM logs WHERE plant_name = ?', ['Test Plant']);
    console.log(`✅ Database test operations successful (${testRows.length} test rows)`);
    
    // Clean up test data
    await db.run('DELETE FROM logs WHERE plant_name = ?', ['Test Plant']);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    throw error;
  }
};

// Main setup function
const setup = async () => {
  try {
    await createDirectories();
    await installDependencies();
    await testDatabase();
    
    console.log('\n🎉 Installation Setup Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start backend: cd backend && npm start');
    console.log('2. Start frontend: cd frontend && npm run dev');
    console.log('3. Open browser to: http://localhost:5173');
    console.log('\n🌱 Happy Growing!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
};

// Run setup
setup();
