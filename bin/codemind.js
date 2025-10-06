#!/usr/bin/env node

/**
 * Global CodeMind CLI entry point
 * Allows running `codemind` from anywhere after npm install -g
 */

const path = require('path');
const fs = require('fs');

// Store original working directory
const originalCwd = process.cwd();
const projectRoot = path.join(__dirname, '..');

// Find the actual CLI file
const cliPath = path.join(projectRoot, 'dist', 'cli', 'codemind-cli.js');

if (fs.existsSync(cliPath)) {
  try {
    // Set environment variable with user's original working directory
    process.env.CODEMIND_USER_CWD = originalCwd;

    // Change to project root directory for proper module resolution
    process.chdir(projectRoot);

    // Execute the CLI directly and call main function
    const cliModule = require(cliPath);
    if (cliModule.main) {
      cliModule.main().catch((error) => {
        console.error('❌ Failed to start CodeMind CLI:', error.message);
        process.exit(1);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start CodeMind CLI:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ CodeMind not built. Run: npm run build');
  process.exit(1);
}