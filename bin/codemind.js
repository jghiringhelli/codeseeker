#!/usr/bin/env node

/**
 * Global CodeMind CLI entry point
 * Allows running `codemind` from anywhere after npm install -g
 */

const path = require('path');
const fs = require('fs');

// Find the actual CLI file
const cliPath = path.join(__dirname, '..', 'dist', 'cli', 'codemind-unified-cli.js');

if (fs.existsSync(cliPath)) {
  // Load and run the main CLI
  try {
    const { main } = require(cliPath);
    if (typeof main === 'function') {
      main().catch((error) => {
        console.error(`❌ Failed to start CodeMind CLI: ${error.message}`);
        process.exit(1);
      });
    } else {
      console.error('❌ Could not find main function in CLI');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error loading CLI: ${error.message}`);
    process.exit(1);
  }
} else {
  console.error('❌ CodeMind not built. Run: npm run build');
  process.exit(1);
}