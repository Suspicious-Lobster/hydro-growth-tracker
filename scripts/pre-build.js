#!/usr/bin/env node
// scripts/pre-build.js

import { promises as fs } from 'fs';
import path from 'path';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const preBuild = async () => {
  log('🔨 Pre-build Tasks Starting', 'bright');
  log('=' .repeat(40), 'blue');

  try {
    // 1. Create database backup (skip if database doesn't exist yet)
    log('📁 Checking for database backup...', 'yellow');
    try {
      await fs.access('./backend/database/hydro-growth-tracker.db');
      log('ℹ️  Database found - backup would be created in production', 'blue');
    } catch (error) {
      log('ℹ️  No database file found - will be created on first run', 'blue');
    }

    // 2. Clean previous builds
    log('🧹 Cleaning previous builds...', 'yellow');
    try {
      await fs.rm('./dist', { recursive: true, force: true });
      await fs.rm('./frontend/dist', { recursive: true, force: true });
      log('✅ Previous builds cleaned', 'green');
    } catch (error) {
      log('ℹ️  No previous builds to clean', 'blue');
    }

    // 3. Validate environment
    log('🔍 Validating environment...', 'yellow');
    
    // Check if .env.example exists
    try {
      await fs.access('./backend/.env.example');
      log('✅ Environment template exists', 'green');
    } catch (error) {
      log('⚠️  .env.example not found', 'yellow');
    }

    // 4. Check package versions consistency
    log('📦 Checking package consistency...', 'yellow');
    
    const rootPkg = JSON.parse(await fs.readFile('./package.json', 'utf8'));
    const backendPkg = JSON.parse(await fs.readFile('./backend/package.json', 'utf8'));
    const frontendPkg = JSON.parse(await fs.readFile('./frontend/package.json', 'utf8'));

    if (rootPkg.version === backendPkg.version && rootPkg.version === frontendPkg.version) {
      log(`✅ All package versions match: ${rootPkg.version}`, 'green');
    } else {
      log('⚠️  Package versions don\'t match:', 'yellow');
      log(`   Root: ${rootPkg.version}`, 'yellow');
      log(`   Backend: ${backendPkg.version}`, 'yellow');
      log(`   Frontend: ${frontendPkg.version}`, 'yellow');
    }

    // 5. Ensure production files
    log('📄 Ensuring production files...', 'yellow');
    
    const productionFiles = [
      { path: './start.bat', content: startBatContent },
      { path: './start.ps1', content: startPs1Content },
      { path: './README.md', required: true }
    ];

    for (const file of productionFiles) {
      try {
        await fs.access(file.path);
        log(`✅ ${file.path} exists`, 'green');
      } catch (error) {
        if (file.content) {
          await fs.writeFile(file.path, file.content);
          log(`✅ Created ${file.path}`, 'green');
        } else if (file.required) {
          log(`❌ Missing required file: ${file.path}`, 'red');
          throw new Error(`Required file missing: ${file.path}`);
        }
      }
    }

    log('=' .repeat(40), 'blue');
    log('🎉 Pre-build tasks completed successfully!', 'green');
    
  } catch (error) {
    log('=' .repeat(40), 'blue');
    log(`❌ Pre-build failed: ${error.message}`, 'red');
    process.exit(1);
  }
};

const startBatContent = `@echo off
echo Starting Hydro Growth Tracker...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Start the application
echo Starting backend server...
start "Backend" cmd /k "cd /d backend && npm start"

timeout /t 3 /nobreak >nul

echo Starting frontend...
start "Frontend" cmd /k "cd /d frontend && npm run dev"

echo.
echo Hydro Growth Tracker is starting...
echo Backend will be available at: http://localhost:5000
echo Frontend will be available at: http://localhost:5173
echo.
pause`;

const startPs1Content = `# Hydro Growth Tracker Startup Script
Write-Host "Starting Hydro Growth Tracker..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Start backend
Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm start" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Hydro Growth Tracker is starting..." -ForegroundColor Green
Write-Host "Backend will be available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"`;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  preBuild();
}
