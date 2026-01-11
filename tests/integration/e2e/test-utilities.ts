/**
 * E2E Test Utilities
 *
 * Provides setup/teardown, mock Claude executor, and verification helpers.
 * Supports both embedded and server storage modes.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  TestConfig,
  TestStorageConfig,
  createTestConfig,
  getTestEnvVars,
  checkServerAvailability,
  DEFAULT_CONFIG
} from './test-config';

const fsPromises = fs.promises;

// Re-export config types and defaults
export { TestConfig, DEFAULT_CONFIG, createTestConfig, getTestEnvVars };

// ============================================================================
// Project Setup/Teardown
// ============================================================================

async function rmWithRetry(dirPath: string, maxRetries = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fsPromises.rm(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
      return;
    } catch (error: any) {
      if ((error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOTEMPTY') && attempt < maxRetries) {
        console.log(`    Retry ${attempt}/${maxRetries}: Directory busy, waiting ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      } else if (error.code === 'ENOENT') {
        return;
      } else if (attempt >= maxRetries) {
        console.warn(`    Warning: Could not delete ${dirPath} after ${maxRetries} attempts: ${error.message}`);
        return;
      } else {
        throw error;
      }
    }
  }
}

export async function setupTestProject(config: TestConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('Setting up test project...');
  console.log(`  Storage mode: ${config.storage.mode.toUpperCase()}`);

  // Check server availability if in server mode
  if (config.storage.mode === 'server') {
    const availability = await checkServerAvailability(config.storage);
    console.log(`  PostgreSQL: ${availability.postgres ? 'available' : 'not available'}`);
    console.log(`  Neo4j: ${availability.neo4j ? 'available' : 'not available'}`);
    console.log(`  Redis: ${availability.redis ? 'available' : 'not available'}`);

    if (!availability.postgres) {
      console.warn('  ⚠️  PostgreSQL not available - tests may fail or use fallback');
    }
  }

  // Clean up existing test project
  if (fs.existsSync(config.testProjectPath)) {
    console.log(`  Removing existing test project at ${config.testProjectPath}`);
    await rmWithRetry(config.testProjectPath);
  }

  // Clean up embedded data directory if using embedded mode
  if (config.storage.mode === 'embedded' && config.storage.embedded) {
    if (fs.existsSync(config.storage.embedded.dataDir)) {
      console.log(`  Removing existing embedded data at ${config.storage.embedded.dataDir}`);
      await rmWithRetry(config.storage.embedded.dataDir);
    }
    // Create the data directory
    await fsPromises.mkdir(config.storage.embedded.dataDir, { recursive: true });
  }

  // Check if original project exists, if not try to extract from zip
  if (!fs.existsSync(config.originalProjectPath)) {
    const zipPath = config.originalProjectPath + '.zip';
    if (fs.existsSync(zipPath)) {
      console.log(`  Extracting fixture from ${zipPath}`);
      const { execSync } = await import('child_process');
      // Create the target directory since the zip doesn't have a root folder
      await fsPromises.mkdir(config.originalProjectPath, { recursive: true });
      try {
        // Try using unzip (Unix) or PowerShell Expand-Archive (Windows)
        // Extract directly into the target directory
        if (process.platform === 'win32') {
          execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${config.originalProjectPath}' -Force"`, { stdio: 'inherit' });
        } else {
          execSync(`unzip -o "${zipPath}" -d "${config.originalProjectPath}"`, { stdio: 'inherit' });
        }
      } catch (extractError) {
        throw new Error(`Failed to extract test fixture from ${zipPath}: ${extractError}`);
      }
    } else {
      throw new Error(`Test fixture not found: ${config.originalProjectPath} (and no .zip file available)`);
    }
  }

  // Copy test project
  console.log(`  Copying from ${config.originalProjectPath}`);
  await copyDirectory(config.originalProjectPath, config.testProjectPath);

  // Remove any existing .codeseeker folder
  const codeseekerDir = path.join(config.testProjectPath, '.codeseeker');
  if (fs.existsSync(codeseekerDir)) {
    await rmWithRetry(codeseekerDir);
  }

  console.log(`Test project ready at ${config.testProjectPath}`);
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await fsPromises.mkdir(dest, { recursive: true });
  const entries = await fsPromises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fsPromises.copyFile(srcPath, destPath);
    }
  }
}

export interface CleanupResult {
  projectDeleted: boolean;
  embeddedDataDeleted: boolean;
  postgresRecordsDeleted: number;
  neo4jNodesDeleted: number;
  errors: string[];
}

export async function teardownTestProject(config: TestConfig = DEFAULT_CONFIG): Promise<CleanupResult> {
  console.log('Tearing down test project...');
  const result: CleanupResult = {
    projectDeleted: false,
    embeddedDataDeleted: false,
    postgresRecordsDeleted: 0,
    neo4jNodesDeleted: 0,
    errors: []
  };

  // Delete test project directory
  if (fs.existsSync(config.testProjectPath)) {
    try {
      await rmWithRetry(config.testProjectPath);
      result.projectDeleted = true;
    } catch (error) {
      result.errors.push(`Failed to delete project: ${error}`);
    }
  }

  // Clean up based on storage mode
  if (!config.skipCleanup) {
    if (config.storage.mode === 'embedded' && config.storage.embedded) {
      // Clean up embedded data
      try {
        if (fs.existsSync(config.storage.embedded.dataDir)) {
          await rmWithRetry(config.storage.embedded.dataDir);
          result.embeddedDataDeleted = true;
        }
      } catch (error) {
        result.errors.push(`Failed to delete embedded data: ${error}`);
      }
    } else if (config.storage.mode === 'server' && config.storage.server) {
      // Clean up server databases
      try {
        result.postgresRecordsDeleted = await cleanupPostgres(config);
      } catch (error) {
        result.errors.push(`PostgreSQL cleanup failed: ${error}`);
      }
      try {
        result.neo4jNodesDeleted = await cleanupNeo4j(config);
      } catch (error) {
        result.errors.push(`Neo4j cleanup failed: ${error}`);
      }
    }
  }

  return result;
}

async function cleanupPostgres(config: TestConfig): Promise<number> {
  if (config.storage.mode !== 'server' || !config.storage.server) return 0;

  const { Pool } = await import('pg');
  const pool = new Pool(config.storage.server.postgres);

  try {
    const projectResult = await pool.query(
      'SELECT id FROM projects WHERE project_path = $1',
      [config.testProjectPath]
    );

    if (projectResult.rows.length === 0) return 0;

    const projectId = projectResult.rows[0].id;
    let totalDeleted = 0;

    // Delete from related tables
    const tables = [
      'semantic_search_embeddings',
      'file_content_cache',
      'initialization_progress',
      'documentation_chunks',
      'documentation_sources',
      'project_platforms'
    ];

    for (const table of tables) {
      try {
        const r = await pool.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
        totalDeleted += r.rowCount || 0;
      } catch {
        // Table might not exist
      }
    }

    // Delete project
    const deleteResult = await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    totalDeleted += deleteResult.rowCount || 0;

    return totalDeleted;
  } finally {
    await pool.end();
  }
}

async function cleanupNeo4j(config: TestConfig): Promise<number> {
  if (config.storage.mode !== 'server' || !config.storage.server) return 0;

  const neo4j = await import('neo4j-driver');
  const driver = neo4j.default.driver(
    config.storage.server.neo4j.uri,
    neo4j.default.auth.basic(config.storage.server.neo4j.user, config.storage.server.neo4j.password)
  );

  try {
    const session = driver.session();
    try {
      const result = await session.run(
        `MATCH (n) WHERE n.projectPath STARTS WITH $path OR n.filePath STARTS WITH $path
         DETACH DELETE n RETURN count(n) as deleted`,
        { path: config.testProjectPath }
      );
      return result.records[0]?.get('deleted')?.toNumber() || 0;
    } finally {
      await session.close();
    }
  } finally {
    await driver.close();
  }
}

// ============================================================================
// Mock Claude Executor
// ============================================================================

export interface MockClaudeResponse {
  query: string;
  response: string;
  filesModified?: string[];
  delay?: number;
}

const MOCK_RESPONSES: MockClaudeResponse[] = [
  { query: 'add input validation', response: 'Added input validation to registerUser function.', filesModified: ['server/controllers/MegaController.js'], delay: 100 },
  { query: 'add try-catch error handling', response: 'Added try-catch error handling to processContract.', filesModified: ['server/controllers/BusinessLogic.js'], delay: 100 },
  { query: 'extract the email sending logic', response: 'Extracted email logic into EmailService.', filesModified: ['server/services/EmailService.js'], delay: 100 },
  { query: 'add a deleteContract method', response: 'Added deleteContract method with validation.', filesModified: ['server/controllers/MegaController.js'], delay: 100 },
  { query: 'ProcessorFactory', response: 'Converted string comparisons to use constants.', filesModified: ['server/services/ProcessorFactory.js'], delay: 100 }
];

export class MockClaudeExecutor {
  private responses: MockClaudeResponse[] = MOCK_RESPONSES;
  private executionLog: Array<{ query: string; response: string; timestamp: Date }> = [];

  addMockResponse(response: MockClaudeResponse): void {
    this.responses.unshift(response);
  }

  async execute(query: string): Promise<string> {
    const matchedResponse = this.responses.find(r =>
      query.toLowerCase().includes(r.query.toLowerCase()) ||
      new RegExp(r.query, 'i').test(query)
    );

    if (!matchedResponse) {
      const defaultResponse = `Processed: ${query}`;
      this.executionLog.push({ query, response: defaultResponse, timestamp: new Date() });
      return defaultResponse;
    }

    if (matchedResponse.delay) {
      await new Promise(resolve => setTimeout(resolve, matchedResponse.delay));
    }

    this.executionLog.push({ query, response: matchedResponse.response, timestamp: new Date() });
    return matchedResponse.response;
  }

  getExecutionLog() { return [...this.executionLog]; }
  clearLog(): void { this.executionLog = []; }
}

// ============================================================================
// codeseeker CLI Executor
// ============================================================================

export interface CLIExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface CLIExecutionOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
  mockClaude?: MockClaudeExecutor;
  stdinInput?: string;
  config?: TestConfig;
}

export async function executecodeseeker(args: string, options: CLIExecutionOptions = {}): Promise<CLIExecutionResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 120000;
  const config = options.config || DEFAULT_CONFIG;
  const cwd = options.cwd || config.testProjectPath;

  // Build environment with storage config
  const storageEnv = getTestEnvVars(config);
  const env = {
    ...process.env,
    ...storageEnv,
    ...options.env,
    ...(options.mockClaude ? { CODESEEKER_MOCK_CLAUDE: 'true' } : {})
  };

  return new Promise((resolve) => {
    const binPath = path.join(__dirname, '../../..', 'bin/codeseeker.js');
    const child = spawn('node', [binPath, ...args.split(' ').filter(a => a)], {
      cwd,
      env,
      shell: true
    });

    let stdout = '';
    let stderr = '';
    let timeoutHandle: NodeJS.Timeout;

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    if (options.stdinInput) {
      setTimeout(() => {
        if (child.stdin) {
          child.stdin.write(options.stdinInput);
          child.stdin.end();
        }
      }, 1000);
    }

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      // Ensure child process is fully terminated
      if (!child.killed) {
        child.kill('SIGKILL');
      }
      resolve({ stdout, stderr, exitCode: code || 0, duration: Date.now() - startTime });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      // Ensure child process is fully terminated
      if (!child.killed) {
        child.kill('SIGKILL');
      }
      resolve({ stdout, stderr: stderr + '\n' + error.message, exitCode: 1, duration: Date.now() - startTime });
    });

    timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL'); // Use SIGKILL for immediate termination
      resolve({ stdout, stderr: stderr + '\nProcess timed out', exitCode: 124, duration: Date.now() - startTime });
    }, timeout);
  });
}

export async function executeQuery(query: string, options: CLIExecutionOptions = {}): Promise<CLIExecutionResult> {
  return executecodeseeker(`-c "${query.replace(/"/g, '\\"')}"`, options);
}

// ============================================================================
// Verification Helpers
// ============================================================================

export interface SearchResult {
  filesFound: string[];
  enhancedPrompt: string;
  relationships: string[];
}

export interface DatabaseState {
  connected: boolean;
  recordCount: number;
  error?: string;
}

export async function verifySearchResults(
  query: string,
  expectedPatterns: string[],
  config: TestConfig = DEFAULT_CONFIG
): Promise<{ passed: boolean; details: string[] }> {
  const result = await executeQuery(query, { cwd: config.testProjectPath, config });
  const details: string[] = [];
  let allPassed = true;

  for (const pattern of expectedPatterns) {
    if (new RegExp(pattern, 'i').test(result.stdout)) {
      details.push(`Found pattern: ${pattern}`);
    } else {
      details.push(`Missing pattern: ${pattern}`);
      allPassed = false;
    }
  }

  return { passed: allPassed, details };
}

export async function verifyDatabaseState(config: TestConfig = DEFAULT_CONFIG): Promise<{
  postgres: DatabaseState;
  neo4j: DatabaseState;
  embedded: DatabaseState;
}> {
  if (config.storage.mode === 'embedded') {
    return {
      postgres: { connected: false, recordCount: 0 },
      neo4j: { connected: false, recordCount: 0 },
      embedded: await getEmbeddedState(config)
    };
  }

  return {
    postgres: await getPostgresState(config),
    neo4j: await getNeo4jState(config),
    embedded: { connected: false, recordCount: 0 }
  };
}

async function getEmbeddedState(config: TestConfig): Promise<DatabaseState> {
  if (config.storage.mode !== 'embedded' || !config.storage.embedded) {
    return { connected: false, recordCount: 0 };
  }

  try {
    const dataDir = config.storage.embedded.dataDir;
    const vectorsDb = path.join(dataDir, 'vectors.db');

    if (!fs.existsSync(vectorsDb)) {
      return { connected: true, recordCount: 0 };
    }

    // Use better-sqlite3 to count records
    const Database = require('better-sqlite3');
    const db = new Database(vectorsDb, { readonly: true });

    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM embeddings').get() as { count: number };
      return { connected: true, recordCount: result?.count || 0 };
    } catch {
      // Table might not exist yet
      return { connected: true, recordCount: 0 };
    } finally {
      db.close();
    }
  } catch (error) {
    return { connected: false, recordCount: 0, error: String(error) };
  }
}

async function getPostgresState(config: TestConfig): Promise<DatabaseState> {
  if (config.storage.mode !== 'server' || !config.storage.server) {
    return { connected: false, recordCount: 0 };
  }

  try {
    const { Pool } = await import('pg');
    const pool = new Pool(config.storage.server.postgres);

    try {
      const projectResult = await pool.query(
        'SELECT id FROM projects WHERE project_path = $1',
        [config.testProjectPath]
      );

      if (projectResult.rows.length === 0) {
        return { connected: true, recordCount: 0 };
      }

      const projectId = projectResult.rows[0].id;
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM semantic_search_embeddings WHERE project_id = $1',
        [projectId]
      );

      return { connected: true, recordCount: parseInt(countResult.rows[0].count, 10) };
    } finally {
      await pool.end();
    }
  } catch (error) {
    return { connected: false, recordCount: 0, error: String(error) };
  }
}

async function getNeo4jState(config: TestConfig): Promise<DatabaseState> {
  if (config.storage.mode !== 'server' || !config.storage.server) {
    return { connected: false, recordCount: 0 };
  }

  try {
    const neo4j = await import('neo4j-driver');
    const driver = neo4j.default.driver(
      config.storage.server.neo4j.uri,
      neo4j.default.auth.basic(config.storage.server.neo4j.user, config.storage.server.neo4j.password)
    );

    try {
      const session = driver.session();
      try {
        const result = await session.run(
          `MATCH (n) WHERE n.projectPath STARTS WITH $path OR n.filePath STARTS WITH $path
           RETURN count(n) as count`,
          { path: config.testProjectPath }
        );
        return { connected: true, recordCount: result.records[0]?.get('count')?.toNumber() || 0 };
      } finally {
        await session.close();
      }
    } finally {
      await driver.close();
    }
  } catch (error) {
    return { connected: false, recordCount: 0, error: String(error) };
  }
}

export async function verifyFileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function verifyFileContains(
  filePath: string,
  patterns: string[]
): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;

  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    for (const pattern of patterns) {
      if (new RegExp(pattern, 'i').test(content)) {
        details.push(`Found pattern: ${pattern}`);
      } else {
        details.push(`Missing pattern: ${pattern}`);
        allPassed = false;
      }
    }
  } catch (error) {
    details.push(`Failed to read file: ${error}`);
    allPassed = false;
  }

  return { passed: allPassed, details };
}

// ============================================================================
// Test Assertion Helpers
// ============================================================================

export class TestAssertions {
  private failures: string[] = [];
  private testName: string = '';

  setTestName(name: string): void { this.testName = name; }

  assert(condition: boolean, message: string): void {
    if (!condition) {
      this.failures.push(`[${this.testName}] ${message}`);
    }
  }

  assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
      this.failures.push(`[${this.testName}] ${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertContains(text: string, pattern: string, message: string): void {
    if (!text.includes(pattern) && !new RegExp(pattern, 'i').test(text)) {
      this.failures.push(`[${this.testName}] ${message}: "${pattern}" not found`);
    }
  }

  assertNotContains(text: string, pattern: string, message: string): void {
    if (text.includes(pattern) || new RegExp(pattern, 'i').test(text)) {
      this.failures.push(`[${this.testName}] ${message}: "${pattern}" was found`);
    }
  }

  getFailures(): string[] { return [...this.failures]; }
  hasFailures(): boolean { return this.failures.length > 0; }
  clear(): void { this.failures = []; this.testName = ''; }
}

export const assertions = new TestAssertions();