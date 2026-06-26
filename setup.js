#!/usr/bin/env node

/**
 * Installation Setup Script for Hydro Growth Tracker
 * Installs dependencies for the Electron shell and the React frontend.
 * Data is stored in a local JSON file managed by the Electron main process,
 * so there is no separate backend service to configure.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

console.log('🌿 Hydro Growth Tracker - Installation Setup');
console.log('===========================================');

const installIn = (cwd, label) =>
  new Promise((resolve, reject) => {
    console.log(`Installing ${label} dependencies...`);
    const child = spawn('npm', ['install'], { cwd, stdio: 'inherit', shell: true });
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${label} dependencies installed`);
        resolve();
      } else {
        reject(new Error(`${label} install failed with code ${code}`));
      }
    });
  });

const setup = async () => {
  try {
    console.log('\n📦 Installing dependencies...');
    await installIn(projectRoot, 'root');
    await installIn(path.join(projectRoot, 'frontend'), 'frontend');

    console.log('\n🎉 Installation Setup Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start the app in development: npm run dev');
    console.log('2. Build a desktop installer:    npm run dist');
    console.log('\n🌱 Happy Growing!');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
};

setup();
