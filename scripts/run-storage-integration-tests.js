#!/usr/bin/env node
/**
 * Storage Integration Test Runner
 *
 * Runs storage integration tests across multiple configurations:
 * - All embedded (SQLite + Graphology + LRU-cache)
 * - All server (PostgreSQL + Neo4j + Redis)
 * - Hybrid: PostgreSQL vectors + embedded graph/cache
 * - Hybrid: Neo4j graph + embedded vectors/cache
 *
 * Usage:
 *   node scripts/run-storage-integration-tests.js [options]
 *
 * Options:
 *   --mode=<mode>     Run specific mode only: embedded, server, hybrid-pg, hybrid-neo4j, all
 *   --verbose         Show detailed test output
 *   --skip-server     Skip server-dependent tests if servers unavailable
 *   --parallel        Run independent test suites in parallel
 */

const { spawn } = require('child_process');
const { Pool } = require('pg');
const path = require('path');

// Test configurations
const TEST_CONFIGS = [
  {
    id: 'embedded',
    name: 'All Embedded (SQLite + Graphology + LRU)',
    description: 'Zero-dependency embedded storage - no Docker required',
    env: {
      CODEMIND_STORAGE_MODE: 'embedded'
    },
    requiresServer: false
  },
  {
    id: 'server',
    name: 'All Server (PostgreSQL + Neo4j + Redis)',
    description: 'Full production stack with external databases',
    env: {
      CODEMIND_STORAGE_MODE: 'server',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '5432',
      DB_NAME: process.env.DB_NAME || 'codemind',
      DB_USER: process.env.DB_USER || 'codemind',
      DB_PASSWORD: process.env.DB_PASSWORD || 'codemind123',
      NEO4J_URI: process.env.NEO4J_URI || 'bolt://localhost:7687',
      NEO4J_USER: process.env.NEO4J_USER || 'neo4j',
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'codemind123',
      REDIS_HOST: process.env.REDIS_HOST || 'localhost',
      REDIS_PORT: process.env.REDIS_PORT || '6379'
    },
    requiresServer: true
  },
  {
    id: 'hybrid-pg',
    name: 'Hybrid: PostgreSQL Vectors + Embedded Graph/Cache',
    description: 'Use PostgreSQL for persistent vectors, embedded for graph and cache',
    env: {
      CODEMIND_STORAGE_MODE: 'embedded',
      CODEMIND_VECTOR_STORE: 'server',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '5432',
      DB_NAME: process.env.DB_NAME || 'codemind',
      DB_USER: process.env.DB_USER || 'codemind',
      DB_PASSWORD: process.env.DB_PASSWORD || 'codemind123'
    },
    requiresServer: true,
    requiresPostgres: true
  },
  {
    id: 'hybrid-neo4j',
    name: 'Hybrid: Neo4j Graph + Embedded Vectors/Cache',
    description: 'Use Neo4j for graph queries, embedded for vectors and cache',
    env: {
      CODEMIND_STORAGE_MODE: 'embedded',
      CODEMIND_GRAPH_STORE: 'server',
      NEO4J_URI: process.env.NEO4J_URI || 'bolt://localhost:7687',
      NEO4J_USER: process.env.NEO4J_USER || 'neo4j',
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'codemind123'
    },
    requiresServer: true,
    requiresNeo4j: true
  }
];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'all',
    verbose: false,
    skipServer: false,
    parallel: false
  };

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--skip-server') {
      options.skipServer = true;
    } else if (arg === '--parallel') {
      options.parallel = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Storage Integration Test Runner

Runs storage integration tests across multiple configurations to ensure
the storage abstraction layer works correctly in all modes.

Usage:
  node scripts/run-storage-integration-tests.js [options]

Options:
  --mode=<mode>     Run specific mode only
                    Values: embedded, server, hybrid-pg, hybrid-neo4j, all
                    Default: all

  --verbose, -v     Show detailed test output

  --skip-server     Skip tests that require server databases
                    (PostgreSQL, Neo4j, Redis)

  --parallel        Run independent test suites in parallel
                    (Not recommended for database tests)

  --help, -h        Show this help message

Examples:
  # Run all configurations
  node scripts/run-storage-integration-tests.js

  # Run only embedded mode (no Docker required)
  node scripts/run-storage-integration-tests.js --mode=embedded

  # Run server mode with verbose output
  node scripts/run-storage-integration-tests.js --mode=server --verbose

  # Run all modes that don't require servers
  node scripts/run-storage-integration-tests.js --skip-server

Test Configurations:
${TEST_CONFIGS.map(c => `  ${c.id.padEnd(12)} - ${c.name}`).join('\n')}
`);
}

// Check if PostgreSQL is available
async function checkPostgres(config) {
  try {
    const pool = new Pool({
      host: config.env.DB_HOST || 'localhost',
      port: parseInt(config.env.DB_PORT || '5432'),
      database: config.env.DB_NAME || 'codemind',
      user: config.env.DB_USER || 'codemind',
      password: config.env.DB_PASSWORD || 'codemind123',
      connectionTimeoutMillis: 3000
    });
    await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

// Check if Neo4j is available
async function checkNeo4j(config) {
  try {
    const neo4j = require('neo4j-driver');
    const driver = neo4j.driver(
      config.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        config.env.NEO4J_USER || 'neo4j',
        config.env.NEO4J_PASSWORD || 'codemind123'
      ),
      { connectionTimeout: 3000 }
    );
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    await driver.close();
    return true;
  } catch {
    return false;
  }
}

// Check if Redis is available
async function checkRedis(config) {
  try {
    const { createClient } = require('redis');
    const client = createClient({
      socket: {
        host: config.env.REDIS_HOST || 'localhost',
        port: parseInt(config.env.REDIS_PORT || '6379'),
        connectTimeout: 3000
      },
      password: config.env.REDIS_PASSWORD
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    return false;
  }
}

// Run Jest for a specific configuration
function runTests(config, options) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const env = {
      ...process.env,
      ...config.env
    };

    const args = [
      'jest',
      'tests/storage',
      'tests/integration/storage-init-workflow.test.ts',
      '--forceExit',
      '--detectOpenHandles'
    ];

    if (options.verbose) {
      args.push('--verbose');
    } else {
      args.push('--silent');
    }

    const child = spawn('npx', args, {
      env,
      cwd: path.resolve(__dirname, '..'),
      shell: true,
      stdio: options.verbose ? 'inherit' : 'pipe'
    });

    let stdout = '';
    let stderr = '';

    if (!options.verbose) {
      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });
    }

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        config,
        exitCode: code || 0,
        duration,
        stdout,
        stderr,
        passed: code === 0
      });
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        config,
        exitCode: 1,
        duration,
        stdout,
        stderr: stderr + '\n' + error.message,
        passed: false
      });
    });
  });
}

// Print result summary
function printResult(result, index, total) {
  const status = result.passed ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
  const duration = (result.duration / 1000).toFixed(2);

  console.log(`\n[${index + 1}/${total}] ${status} ${result.config.name}`);
  console.log(`    Duration: ${duration}s`);

  if (!result.passed && result.stderr) {
    console.log(`    Error: ${result.stderr.split('\n')[0]}`);
  }
}

// Print final summary
function printSummary(results) {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log('\n' + '='.repeat(70));
  console.log('STORAGE INTEGRATION TEST SUMMARY');
  console.log('='.repeat(70));

  console.log(`\nResults:`);
  console.log(`  \x1b[32m✓ Passed:\x1b[0m  ${passed}`);
  console.log(`  \x1b[31m✗ Failed:\x1b[0m  ${failed}`);
  if (skipped > 0) {
    console.log(`  \x1b[33m○ Skipped:\x1b[0m ${skipped}`);
  }
  console.log(`  Total:    ${results.length}`);
  console.log(`\nTotal Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  // Show detailed results
  console.log('\nConfiguration Results:');
  for (const result of results) {
    const icon = result.skipped ? '\x1b[33m○\x1b[0m' :
                 result.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const status = result.skipped ? 'SKIPPED' : result.passed ? 'PASS' : 'FAIL';
    const time = result.duration ? ` (${(result.duration / 1000).toFixed(2)}s)` : '';
    console.log(`  ${icon} ${result.config.id.padEnd(12)} ${status}${time}`);
    if (result.skipReason) {
      console.log(`    └─ ${result.skipReason}`);
    }
  }

  console.log('\n' + '='.repeat(70));

  return failed === 0;
}

// Main execution
async function main() {
  const options = parseArgs();

  console.log('='.repeat(70));
  console.log('STORAGE INTEGRATION TEST RUNNER');
  console.log('='.repeat(70));
  console.log(`\nMode: ${options.mode}`);
  console.log(`Skip Server Tests: ${options.skipServer}`);
  console.log(`Verbose: ${options.verbose}`);

  // Filter configurations based on mode
  let configs = TEST_CONFIGS;
  if (options.mode !== 'all') {
    configs = configs.filter(c => c.id === options.mode);
    if (configs.length === 0) {
      console.error(`\nError: Unknown mode "${options.mode}"`);
      console.error(`Valid modes: embedded, server, hybrid-pg, hybrid-neo4j, all`);
      process.exit(1);
    }
  }

  // Check server availability
  console.log('\nChecking server availability...');
  const serverStatus = {
    postgres: await checkPostgres(TEST_CONFIGS.find(c => c.id === 'server')),
    neo4j: await checkNeo4j(TEST_CONFIGS.find(c => c.id === 'server')),
    redis: await checkRedis(TEST_CONFIGS.find(c => c.id === 'server'))
  };

  console.log(`  PostgreSQL: ${serverStatus.postgres ? '\x1b[32mavailable\x1b[0m' : '\x1b[31mnot available\x1b[0m'}`);
  console.log(`  Neo4j:      ${serverStatus.neo4j ? '\x1b[32mavailable\x1b[0m' : '\x1b[31mnot available\x1b[0m'}`);
  console.log(`  Redis:      ${serverStatus.redis ? '\x1b[32mavailable\x1b[0m' : '\x1b[31mnot available\x1b[0m'}`);

  // Run tests
  console.log('\n' + '-'.repeat(70));
  console.log('Running Tests...');
  console.log('-'.repeat(70));

  const results = [];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];

    // Check if we should skip this configuration
    let skipReason = null;

    if (options.skipServer && config.requiresServer) {
      skipReason = 'Skipped (--skip-server flag)';
    } else if (config.requiresServer) {
      if (config.id === 'server' && !(serverStatus.postgres && serverStatus.neo4j && serverStatus.redis)) {
        skipReason = 'Skipped (requires PostgreSQL + Neo4j + Redis)';
      } else if (config.requiresPostgres && !serverStatus.postgres) {
        skipReason = 'Skipped (requires PostgreSQL)';
      } else if (config.requiresNeo4j && !serverStatus.neo4j) {
        skipReason = 'Skipped (requires Neo4j)';
      }
    }

    if (skipReason) {
      console.log(`\n[${i + 1}/${configs.length}] \x1b[33m○ SKIP\x1b[0m ${config.name}`);
      console.log(`    ${skipReason}`);
      results.push({ config, skipped: true, skipReason, passed: true });
      continue;
    }

    console.log(`\n[${i + 1}/${configs.length}] Running: ${config.name}...`);

    const result = await runTests(config, options);
    results.push(result);

    printResult(result, i, configs.length);
  }

  // Print summary
  const allPassed = printSummary(results);

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});