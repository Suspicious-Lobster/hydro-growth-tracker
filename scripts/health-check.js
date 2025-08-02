#!/usr/bin/env node
// scripts/health-check.js

import { promises as fs } from 'fs';
import http from 'http';
import path from 'path';

// Color utilities
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

// Health check functions
const checkBackendHealth = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5000', (res) => {
      resolve({ status: 'online', code: res.statusCode });
    });
    
    req.on('error', () => {
      resolve({ status: 'offline', error: 'Connection failed' });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ status: 'timeout', error: 'Request timeout' });
    });
  });
};

const checkFrontendHealth = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', (res) => {
      resolve({ status: 'online', code: res.statusCode });
    });
    
    req.on('error', () => {
      resolve({ status: 'offline', error: 'Connection failed' });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ status: 'timeout', error: 'Request timeout' });
    });
  });
};

const checkDatabaseHealth = async () => {
  try {
    await fs.access('./backend/database/hydro-growth-tracker.db');
    const stats = await fs.stat('./backend/database/hydro-growth-tracker.db');
    return { 
      status: 'exists', 
      size: `${(stats.size / 1024).toFixed(2)} KB`,
      modified: stats.mtime.toISOString().split('T')[0]
    };
  } catch (error) {
    return { status: 'missing', error: error.message };
  }
};

const checkNodeModules = async () => {
  const modules = ['./node_modules', './backend/node_modules', './frontend/node_modules'];
  const results = {};
  
  for (const mod of modules) {
    try {
      await fs.access(mod);
      results[mod] = 'installed';
    } catch (error) {
      results[mod] = 'missing';
    }
  }
  
  return results;
};

// Main health check function
const runHealthCheck = async () => {
  log('🏥 Hydro Growth Tracker - Health Check', 'bright');
  log('=' .repeat(50), 'blue');
  
  // Check services
  log('🔍 Checking Services...', 'yellow');
  
  const backendHealth = await checkBackendHealth();
  if (backendHealth.status === 'online') {
    log(`✅ Backend: Online (${backendHealth.code})`, 'green');
  } else {
    log(`❌ Backend: ${backendHealth.status} - ${backendHealth.error || 'Unknown error'}`, 'red');
  }
  
  const frontendHealth = await checkFrontendHealth();
  if (frontendHealth.status === 'online') {
    log(`✅ Frontend: Online (${frontendHealth.code})`, 'green');
  } else {
    log(`❌ Frontend: ${frontendHealth.status} - ${frontendHealth.error || 'Unknown error'}`, 'red');
  }
  
  // Check database
  log('🗄️  Checking Database...', 'yellow');
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.status === 'exists') {
    log(`✅ Database: ${dbHealth.size}, last modified: ${dbHealth.modified}`, 'green');
  } else {
    log(`⚠️  Database: Not found (will be created on first run)`, 'yellow');
  }
  
  // Check dependencies
  log('📦 Checking Dependencies...', 'yellow');
  const moduleHealth = await checkNodeModules();
  for (const [module, status] of Object.entries(moduleHealth)) {
    if (status === 'installed') {
      log(`✅ ${module}: Installed`, 'green');
    } else {
      log(`❌ ${module}: Missing`, 'red');
    }
  }
  
  log('=' .repeat(50), 'blue');
  
  // Summary
  const allOnline = backendHealth.status === 'online' && frontendHealth.status === 'online';
  const allModules = Object.values(moduleHealth).every(status => status === 'installed');
  
  if (allOnline && allModules) {
    log('🎉 All systems operational!', 'green');
  } else if (!allOnline && !allModules) {
    log('⚠️  Services offline and dependencies missing', 'yellow');
    log('💡 Run "npm install" in root, backend, and frontend directories', 'blue');
    log('💡 Then run "npm start" to start services', 'blue');
  } else if (!allOnline) {
    log('⚠️  Services offline', 'yellow');
    log('💡 Run "npm start" to start services', 'blue');
  } else if (!allModules) {
    log('⚠️  Some dependencies missing', 'yellow');
    log('💡 Run "npm install" in directories with missing modules', 'blue');
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthCheck().catch(console.error);
}

export { runHealthCheck };
