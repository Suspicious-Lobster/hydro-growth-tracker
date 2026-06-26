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
    // 1. Clean previous builds
    log('🧹 Cleaning previous builds...', 'yellow');
    try {
      await fs.rm('./dist', { recursive: true, force: true });
      await fs.rm('./frontend/dist', { recursive: true, force: true });
      log('✅ Previous builds cleaned', 'green');
    } catch (error) {
      log('ℹ️  No previous builds to clean', 'blue');
    }

    // 2. Ensure production files
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

REM Start the application (Vite dev server + Electron with embedded backend)
echo Starting Hydro Growth Tracker...
call npm run dev

echo.
echo The app will open automatically. Frontend dev server: http://localhost:5173
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

# Start the application (Vite dev server + Electron with embedded backend)
Write-Host "Starting Hydro Growth Tracker..." -ForegroundColor Yellow
npm run dev

Write-Host ""
Write-Host "The app will open automatically. Frontend dev server: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"`;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  preBuild();
}
