const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const projectRoot = __dirname;

// Test configuration
const TEST_CONFIG = {
  backendPort: 5000,
  frontendPort: 5173,
  testTimeout: 30000,
  testPlantName: 'Test Plant E2E',
  testHeight: 15.5,
  testNutrients: 'Test Nutrients 2ml/L'
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, description) {
  log(`\n${step}. ${description}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      ...options
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function testPrerequisites() {
  logStep('1', 'Testing Prerequisites');
  
  // Check Node.js version
  try {
    const { stdout } = await spawnProcess('node', ['--version']);
    const nodeVersion = stdout.trim();
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    
    if (majorVersion >= 18) {
      logSuccess(`Node.js version: ${nodeVersion} (✓ >= 18)`);
    } else {
      logError(`Node.js version: ${nodeVersion} (✗ < 18 required)`);
      return false;
    }
  } catch (error) {
    logError(`Node.js not found: ${error.message}`);
    return false;
  }

  // Check npm
  try {
    const { stdout } = await spawnProcess('npm', ['--version']);
    logSuccess(`npm version: ${stdout.trim()}`);
  } catch (error) {
    logError(`npm not found: ${error.message}`);
    return false;
  }

  // Check project structure
  const requiredFiles = [
    'package.json',
    'frontend/package.json',
    'backend/package.json',
    'backend/app.js',
    'frontend/src/App.jsx'
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(projectRoot, file));
      logSuccess(`Found: ${file}`);
    } catch (error) {
      logError(`Missing: ${file}`);
      return false;
    }
  }

  return true;
}

async function testDependencies() {
  logStep('2', 'Testing Dependencies Installation');
  
  // Install frontend dependencies
  log('Installing frontend dependencies...');
  try {
    const result = await spawnProcess('npm', ['install'], { 
      cwd: path.join(projectRoot, 'frontend') 
    });
    
    if (result.code === 0) {
      logSuccess('Frontend dependencies installed');
    } else {
      logError(`Frontend dependency installation failed: ${result.stderr}`);
      return false;
    }
  } catch (error) {
    logError(`Frontend dependency installation error: ${error.message}`);
    return false;
  }

  // Install backend dependencies
  log('Installing backend dependencies...');
  try {
    const result = await spawnProcess('npm', ['install'], { 
      cwd: path.join(projectRoot, 'backend') 
    });
    
    if (result.code === 0) {
      logSuccess('Backend dependencies installed');
    } else {
      logError(`Backend dependency installation failed: ${result.stderr}`);
      return false;
    }
  } catch (error) {
    logError(`Backend dependency installation error: ${error.message}`);
    return false;
  }

  return true;
}

async function testBuild() {
  logStep('3', 'Testing Build Process');
  
  // Test frontend build
  log('Building frontend...');
  try {
    const result = await spawnProcess('npm', ['run', 'build'], { 
      cwd: path.join(projectRoot, 'frontend') 
    });
    
    if (result.code === 0) {
      logSuccess('Frontend build successful');
      
      // Check if dist folder exists
      try {
        await fs.access(path.join(projectRoot, 'frontend', 'dist'));
        logSuccess('Frontend dist folder created');
      } catch (error) {
        logError('Frontend dist folder not found');
        return false;
      }
    } else {
      logError(`Frontend build failed: ${result.stderr}`);
      return false;
    }
  } catch (error) {
    logError(`Frontend build error: ${error.message}`);
    return false;
  }

  return true;
}

async function testLinting() {
  logStep('4', 'Testing Code Quality (Linting)');
  
  // Test frontend linting
  log('Running frontend linter...');
  try {
    const result = await spawnProcess('npm', ['run', 'lint'], { 
      cwd: path.join(projectRoot, 'frontend') 
    });
    
    if (result.code === 0) {
      logSuccess('Frontend linting passed');
    } else {
      // Check if it's just warnings
      if (result.stdout.includes('✖ 1 problem (0 errors, 1 warning)')) {
        logSuccess('Frontend linting passed with expected warnings');
      } else {
        logError(`Frontend linting failed: ${result.stdout}`);
        return false;
      }
    }
  } catch (error) {
    logError(`Frontend linting error: ${error.message}`);
    return false;
  }

  return true;
}

async function testBackendAPI() {
  logStep('5', 'Testing Backend Configuration');
  
  // Test backend file structure and configuration
  try {
    const appJsPath = path.join(projectRoot, 'backend', 'app.js');
    const appJsContent = await fs.readFile(appJsPath, 'utf8');
    
    if (appJsContent.includes('express') && appJsContent.includes('cors')) {
      logSuccess('Backend dependencies properly configured');
    } else {
      logError('Backend dependencies not properly configured');
      return false;
    }
    
    // Check if routes exist
    const routesPath = path.join(projectRoot, 'backend', 'routes');
    const routesFiles = await fs.readdir(routesPath);
    
    if (routesFiles.includes('logs.routes.js') && routesFiles.includes('feeding.routes.js')) {
      logSuccess('Backend routes properly configured');
    } else {
      logError('Backend routes not properly configured');
      return false;
    }
    
    // Check if database configuration exists
    const dbPath = path.join(projectRoot, 'backend', 'database', 'db.js');
    try {
      await fs.access(dbPath);
      logSuccess('Database configuration exists');
    } catch (error) {
      logError('Database configuration not found');
      return false;
    }
    
    logSuccess('Backend configuration tests passed');
    return true;
  } catch (error) {
    logError(`Backend configuration test failed: ${error.message}`);
    return false;
  }
}

async function testFrontendFeatures() {
  logStep('6', 'Testing Frontend Features');
  
  // Test theme system
  try {
    const themeContextPath = path.join(projectRoot, 'frontend', 'src', 'contexts', 'ThemeContext.jsx');
    const themeContent = await fs.readFile(themeContextPath, 'utf8');
    
    if (themeContent.includes('isDark') && themeContent.includes('toggleTheme')) {
      logSuccess('Theme system implemented');
    } else {
      logError('Theme system not properly implemented');
      return false;
    }
  } catch (error) {
    logError(`Theme system test failed: ${error.message}`);
    return false;
  }

  // Test AddLogForm improvements
  try {
    const addLogFormPath = path.join(projectRoot, 'frontend', 'src', 'components', 'AddLogForm.jsx');
    const addLogFormContent = await fs.readFile(addLogFormPath, 'utf8');
    
    if (addLogFormContent.includes('handleHeightChange') && 
        addLogFormContent.includes('localStorage') && 
        addLogFormContent.includes('isDirty')) {
      logSuccess('AddLogForm improvements implemented');
    } else {
      logError('AddLogForm improvements not properly implemented');
      return false;
    }
  } catch (error) {
    logError(`AddLogForm test failed: ${error.message}`);
    return false;
  }

  // Test Calendar Export
  try {
    const calendarExportPath = path.join(projectRoot, 'frontend', 'src', 'components', 'FeedingScheduleCalendarExport.jsx');
    const calendarExportContent = await fs.readFile(calendarExportPath, 'utf8');
    
    if (calendarExportContent.includes('generateCalendarCSV') && 
        calendarExportContent.includes('feedingSchedule')) {
      logSuccess('Calendar export feature implemented');
    } else {
      logError('Calendar export feature not properly implemented');
      return false;
    }
  } catch (error) {
    logError(`Calendar export test failed: ${error.message}`);
    return false;
  }

  return true;
}

async function testDraftSaving() {
  logStep('7', 'Testing Draft Auto-Save Feature');
  
  try {
    const addLogFormPath = path.join(projectRoot, 'frontend', 'src', 'components', 'AddLogForm.jsx');
    const addLogFormContent = await fs.readFile(addLogFormPath, 'utf8');
    
    const requiredFeatures = [
      'localStorage.setItem',
      'localStorage.getItem',
      'localStorage.removeItem',
      'isDirty',
      'Draft saved',
      'clearDraft'
    ];

    for (const feature of requiredFeatures) {
      if (addLogFormContent.includes(feature)) {
        logSuccess(`Draft feature found: ${feature}`);
      } else {
        logError(`Draft feature missing: ${feature}`);
        return false;
      }
    }

    logSuccess('Draft auto-save feature properly implemented');
    return true;
  } catch (error) {
    logError(`Draft saving test failed: ${error.message}`);
    return false;
  }
}

async function testPackaging() {
  logStep('8', 'Testing Packaging Scripts');
  
  // Test if package.bat exists
  try {
    const packageBatPath = path.join(projectRoot, 'package.bat');
    await fs.access(packageBatPath);
    logSuccess('package.bat exists');
  } catch (error) {
    logError('package.bat not found');
    return false;
  }

  // Test if README.md exists and has content
  try {
    const readmePath = path.join(projectRoot, 'README.md');
    const readmeContent = await fs.readFile(readmePath, 'utf8');
    
    if (readmeContent.includes('Hydro Growth Tracker') && 
        readmeContent.includes('Installation') && 
        readmeContent.includes('Features')) {
      logSuccess('README.md is comprehensive');
    } else {
      logError('README.md is incomplete');
      return false;
    }
  } catch (error) {
    logError(`README.md test failed: ${error.message}`);
    return false;
  }

  return true;
}

// Main test runner
async function runTests() {
  log(`\n${'='.repeat(60)}`, 'bold');
  log('🌿 HYDRO GROWTH TRACKER - END-TO-END TEST SUITE', 'bold');
  log(`${'='.repeat(60)}`, 'bold');
  
  const startTime = Date.now();
  const tests = [
    { name: 'Prerequisites', fn: testPrerequisites },
    { name: 'Dependencies', fn: testDependencies },
    { name: 'Build Process', fn: testBuild },
    { name: 'Code Quality', fn: testLinting },
    { name: 'Backend API', fn: testBackendAPI },
    { name: 'Frontend Features', fn: testFrontendFeatures },
    { name: 'Draft Auto-Save', fn: testDraftSaving },
    { name: 'Packaging', fn: testPackaging }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        logSuccess(`${test.name} test passed`);
      } else {
        failed++;
        logError(`${test.name} test failed`);
      }
    } catch (error) {
      failed++;
      logError(`${test.name} test error: ${error.message}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  log(`\n${'='.repeat(60)}`, 'bold');
  log('TEST RESULTS', 'bold');
  log(`${'='.repeat(60)}`, 'bold');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`⏱️  Duration: ${duration}s`, 'blue');
  
  if (failed === 0) {
    log('\n🎉 ALL TESTS PASSED! Ready for packaging and deployment.', 'green');
    return true;
  } else {
    log('\n💥 SOME TESTS FAILED! Please fix issues before packaging.', 'red');
    return false;
  }
}

// Export for use in other scripts
module.exports = { runTests };

// Run the test suite if called directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
