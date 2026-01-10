#!/usr/bin/env node

/**
 * Global CodeSeeker CLI entry point
 * Enhanced for VS Code and multiple environment compatibility
 */

// Suppress dotenv v17+ "injecting env" log message
process.env.DOTENV_CONFIG_QUIET = 'true';

const path = require('path');
const fs = require('fs');
const os = require('os');

// Environment detection
const isVSCode = process.env.TERM_PROGRAM === 'vscode';
const isCodeTunnel = process.env.VSCODE_CLI === '1';
const isWindows = os.platform() === 'win32';
const isWSL = process.env.WSL_DISTRO_NAME || process.env.NAME?.includes('WSL');

// Store original working directory
const originalCwd = process.cwd();

// Enhanced project root detection for different environments
function findProjectRoot() {
  // Standard path (works in most cases)
  let projectRoot = path.join(__dirname, '..');

  // VS Code specific adjustments
  if (isVSCode || isCodeTunnel) {
    // Check if we're in a global npm installation
    if (__dirname.includes('node_modules')) {
      // Find the actual npm global directory
      const npmGlobalDir = __dirname.split('node_modules')[0];
      projectRoot = path.join(npmGlobalDir, 'node_modules', 'codeseeker');
    }
  }

  return projectRoot;
}

const projectRoot = findProjectRoot();

// Debug info for VS Code environments (only show if CLI fails)
let vsCodeDebugInfo = '';
if (isVSCode || isCodeTunnel) {
  vsCodeDebugInfo = `\n🆚 VS Code environment detected\n📁 Project root: ${projectRoot}\n💼 Working directory: ${originalCwd}`;
}

// Enhanced CLI path detection
function findCliPath() {
  const standardPath = path.join(projectRoot, 'dist', 'cli', 'codeseeker-cli.js');

  if (fs.existsSync(standardPath)) {
    return standardPath;
  }

  // Alternative paths for different installations
  const altPaths = [
    path.join(projectRoot, 'src', 'cli', 'codeseeker-cli.ts'),  // Source path
    path.join(__dirname, '..', 'dist', 'cli', 'codeseeker-cli.js'), // Relative path
    path.join(__dirname, 'codeseeker-cli.js'), // Same directory
  ];

  for (const altPath of altPaths) {
    if (fs.existsSync(altPath)) {
      return altPath;
    }
  }

  return standardPath; // Return standard path for error message
}

const cliPath = findCliPath();

// Enhanced error reporting
function reportStartupError(error, context = '') {
  console.error('❌ CodeSeeker CLI startup failed');
  console.error(`🔍 Context: ${context}`);
  console.error(`🔍 Error: ${error.message}`);
  console.error(`🔍 CLI path attempted: ${cliPath}`);
  console.error(`🔍 Project root: ${projectRoot}`);
  console.error(`🔍 Current working directory: ${originalCwd}`);

  if (isVSCode || isCodeTunnel) {
    console.error('🆚 VS Code specific info:');
    console.error(`   TERM_PROGRAM: ${process.env.TERM_PROGRAM}`);
    console.error(`   VSCODE_CLI: ${process.env.VSCODE_CLI}`);
    console.error(`   SHELL: ${process.env.SHELL || 'not set'}`);
  }

  // Diagnostic suggestions
  console.error('\n💡 Troubleshooting steps:');
  console.error('   1. Run: npm run build');
  console.error('   2. Run: npm link');
  console.error('   3. Verify: npm list -g codeseeker');

  if (isVSCode) {
    console.error('   4. VS Code: Try restarting VS Code');
    console.error('   5. VS Code: Check terminal profile settings');
  }
}

// Check if CLI file exists
if (!fs.existsSync(cliPath)) {
  reportStartupError(new Error('CLI file not found'), 'File system check');
  console.error('\n🔧 Build status check:');

  // Check if source exists
  const srcPath = path.join(projectRoot, 'src', 'cli', 'codeseeker-cli.ts');
  if (fs.existsSync(srcPath)) {
    console.error('   ✅ Source file exists');
    console.error('   ❌ Compiled file missing - run: npm run build');
  } else {
    console.error('   ❌ Source file missing - reinstall CodeSeeker');
  }

  process.exit(1);
}

// Startup execution
try {
  // Set environment variables for the CLI
  process.env.CODESEEKER_USER_CWD = originalCwd;
  process.env.CODESEEKER_ENVIRONMENT = isVSCode ? 'vscode' : 'terminal';
  process.env.CODESEEKER_PROJECT_ROOT = projectRoot;

  // Legacy env vars for compatibility during transition
  process.env.CODEMIND_USER_CWD = originalCwd;
  process.env.CODEMIND_ENVIRONMENT = isVSCode ? 'vscode' : 'terminal';
  process.env.CODEMIND_PROJECT_ROOT = projectRoot;

  // Change to project root directory for proper module resolution
  process.chdir(projectRoot);

  // Execute the CLI with enhanced error handling
  const cliModule = require(cliPath);

  if (!cliModule || typeof cliModule.main !== 'function') {
    throw new Error('CLI module invalid or missing main function');
  }

  // Start CLI with additional context
  cliModule.main().catch((error) => {
    reportStartupError(error, 'CLI execution');
    process.exit(1);
  });

} catch (error) {
  reportStartupError(error, 'Module loading');

  // Additional module loading diagnostics
  console.error('\n🔍 Module loading diagnostics:');
  try {
    const stats = fs.statSync(cliPath);
    console.error(`   File size: ${stats.size} bytes`);
    console.error(`   Modified: ${stats.mtime}`);
  } catch (statError) {
    console.error(`   Cannot read file stats: ${statError.message}`);
  }

  // Try to check Node.js module resolution
  try {
    console.error(`   Node.js version: ${process.version}`);
    console.error(`   Module paths: ${require.resolve.paths('codeseeker')?.slice(0,2).join(', ')}...`);
  } catch (resolutionError) {
    console.error(`   Module resolution failed: ${resolutionError.message}`);
  }

  process.exit(1);
}
