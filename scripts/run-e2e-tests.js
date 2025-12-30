#!/usr/bin/env node
/**
 * E2E Test Runner Script
 *
 * Runs the CodeMind E2E integration tests.
 * Automatically extracts the test fixture from zip if not present.
 *
 * Usage:
 *   npm run test:e2e          # Run in mock mode (fast, for CI)
 *   npm run test:e2e:live     # Run in live mode (with real Claude)
 *   node scripts/run-e2e-tests.js --live  # Direct execution
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const FIXTURE_ZIP = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'ContractMaster-Test-Original.zip');
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'ContractMaster-Test-Original');

// Parse arguments
const args = process.argv.slice(2);
const isLive = args.includes('--live');
const isVerbose = args.includes('--verbose') || args.includes('-v');
const isHelp = args.includes('--help') || args.includes('-h');

// Show help
if (isHelp) {
  console.log(`
CodeMind E2E Test Runner

Usage:
  node scripts/run-e2e-tests.js [options]

Options:
  --live      Run with real Claude CLI (slower, requires Claude authentication)
  --verbose   Show detailed output
  --help      Show this help message

Examples:
  node scripts/run-e2e-tests.js          # Mock mode (fast)
  node scripts/run-e2e-tests.js --live   # Live mode (real Claude)

NPM Scripts:
  npm run test:e2e              # Same as mock mode
  npm run test:e2e:live         # Same as live mode
`);
  process.exit(0);
}

/**
 * Extract the test fixture from zip if not already extracted
 */
function extractTestFixture() {
  // Check if already extracted
  if (fs.existsSync(FIXTURE_DIR)) {
    console.log('✅ Test fixture already extracted');
    return true;
  }

  // Check if zip exists
  if (!fs.existsSync(FIXTURE_ZIP)) {
    console.log(`❌ Test fixture zip not found: ${FIXTURE_ZIP}`);
    console.log('   The zip file should be committed to the repository.');
    return false;
  }

  console.log('📦 Extracting test fixture from zip...');

  try {
    // Create destination directory
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });

    // Use PowerShell on Windows, unzip on Unix
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Expand-Archive -Path '${FIXTURE_ZIP}' -DestinationPath '${FIXTURE_DIR}' -Force"`, {
        stdio: isVerbose ? 'inherit' : 'pipe'
      });
    } else {
      execSync(`unzip -o "${FIXTURE_ZIP}" -d "${FIXTURE_DIR}"`, {
        stdio: isVerbose ? 'inherit' : 'pipe'
      });
    }

    console.log('✅ Test fixture extracted successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to extract test fixture:', error.message);
    // Clean up partial extraction
    if (fs.existsSync(FIXTURE_DIR)) {
      fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
    return false;
  }
}

// Check prerequisites
function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');

  // Check if TypeScript is compiled
  const distPath = path.join(PROJECT_ROOT, 'dist');
  if (!fs.existsSync(distPath)) {
    console.log('⚠️  dist/ not found. Building...');
    try {
      execSync('npm run build', { stdio: 'inherit', cwd: PROJECT_ROOT });
      console.log('✅ Build complete\n');
    } catch (error) {
      console.error('❌ Build failed. Please run "npm run build" first.');
      process.exit(1);
    }
  } else {
    console.log('✅ dist/ found');
  }

  // Extract test fixture if needed
  if (!extractTestFixture()) {
    process.exit(1);
  }

  // Check databases (optional)
  console.log('');
}

// Run tests with Jest
function runJestTests() {
  console.log('\n' + '='.repeat(60));
  console.log(`Running E2E Tests in ${isLive ? 'LIVE' : 'MOCK'} mode`);
  console.log('='.repeat(60) + '\n');

  const jestArgs = [
    '--config', 'jest.config.js',
    '--testPathPatterns', 'tests/integration/e2e',
    '--runInBand', // Run serially (required for E2E)
    '--testTimeout', '600000', // 10 minute timeout
    '--forceExit',
  ];

  if (isVerbose) {
    jestArgs.push('--verbose');
  }

  if (isLive) {
    // Pass --live to the test file
    jestArgs.push('--', '--live');
  }

  const jest = spawn('npx', ['jest', ...jestArgs], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      CODEMIND_E2E_LIVE: isLive ? 'true' : 'false'
    }
  });

  jest.on('close', (code) => {
    console.log('\n' + '='.repeat(60));
    if (code === 0) {
      console.log('✅ E2E Tests PASSED');
    } else {
      console.log('❌ E2E Tests FAILED');
    }
    console.log('='.repeat(60) + '\n');
    process.exit(code);
  });

  jest.on('error', (error) => {
    console.error('Failed to run Jest:', error);
    process.exit(1);
  });
}

// Run standalone tests (without Jest)
async function runStandaloneTests() {
  console.log('\n' + '='.repeat(60));
  console.log(`Running E2E Tests (Standalone) in ${isLive ? 'LIVE' : 'MOCK'} mode`);
  console.log('='.repeat(60) + '\n');

  // Compile and run the test file directly
  const tsNode = spawn('npx', [
    'tsx',
    'tests/integration/e2e/codemind-e2e.test.ts',
    ...(isLive ? ['--live'] : [])
  ], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true
  });

  tsNode.on('close', (code) => {
    process.exit(code);
  });

  tsNode.on('error', (error) => {
    console.error('Failed to run tests:', error);
    process.exit(1);
  });
}

// Main
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           CodeMind E2E Integration Test Runner               ║
╚══════════════════════════════════════════════════════════════╝
`);

  checkPrerequisites();

  // Use Jest for structured testing
  runJestTests();
}

main().catch(console.error);
