/**
 * E2E Test Utilities
 * Provides setup/teardown, mock Claude executor, and verification helpers
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import neo4j, { Driver } from 'neo4j-driver';

const fsPromises = fs.promises;

// ============================================================================
// Configuration
// ============================================================================

export interface TestConfig {
  originalProjectPath: string;
  testProjectPath: string;
  useMockClaude: boolean;
  skipCleanup: boolean;
  claudeTimeout: number;
  postgres: { host: string; port: number; database: string; user: string; password: string; };
  neo4j: { uri: string; user: string; password: string; };
}

// Resolve paths relative to project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'tests', 'fixtures');
const TEMP_DIR = path.join(PROJECT_ROOT, 'tests', 'fixtures', '.temp');

export const DEFAULT_CONFIG: TestConfig = {
  originalProjectPath: path.join(FIXTURES_DIR, 'ContractMaster-Test-Original'),
  testProjectPath: path.join(TEMP_DIR, 'ContractMaster-Test-E2E'),
  useMockClaude: true,
  skipCleanup: false,
  claudeTimeout: 120000,
  postgres: { host: 'localhost', port: 5432, database: 'codemind', user: 'codemind', password: 'codemind123' },
  neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'codemind123' }
};

// ============================================================================
// Project Setup/Teardown
// ============================================================================

async function rmWithRetry(dirPath: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fsPromises.rm(dirPath, { recursive: true, force: true });
      return;
    } catch (error: any) {
      if (error.code === 'EBUSY' && attempt < maxRetries) {
        console.log('    Retry ' + attempt + '/' + maxRetries + ': Directory busy, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (error.code === 'ENOENT') {
        return;
      } else {
        throw error;
      }
    }
  }
}

export async function setupTestProject(config: TestConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('Setting up test project...');
  if (fs.existsSync(config.testProjectPath)) {
    console.log('  Removing existing test project at ' + config.testProjectPath);
    await rmWithRetry(config.testProjectPath);
  }
  console.log('  Copying from ' + config.originalProjectPath);
  await copyDirectory(config.originalProjectPath, config.testProjectPath);
  const codemindDir = path.join(config.testProjectPath, '.codemind');
  if (fs.existsSync(codemindDir)) {
    await rmWithRetry(codemindDir);
  }
  console.log('Test project ready at ' + config.testProjectPath);
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
  postgresRecordsDeleted: number;
  neo4jNodesDeleted: number;
  errors: string[];
}

export async function teardownTestProject(config: TestConfig = DEFAULT_CONFIG): Promise<CleanupResult> {
  console.log('Tearing down test project...');
  const result: CleanupResult = { projectDeleted: false, postgresRecordsDeleted: 0, neo4jNodesDeleted: 0, errors: [] };
  if (fs.existsSync(config.testProjectPath)) {
    try {
      await rmWithRetry(config.testProjectPath);
      result.projectDeleted = true;
    } catch (error) {
      result.errors.push('Failed to delete project: ' + error);
    }
  }
  if (!config.skipCleanup) {
    try { result.postgresRecordsDeleted = await cleanupPostgres(config); } catch (error) { result.errors.push('PostgreSQL cleanup failed: ' + error); }
    try { result.neo4jNodesDeleted = await cleanupNeo4j(config); } catch (error) { result.errors.push('Neo4j cleanup failed: ' + error); }
  }
  return result;
}

async function cleanupPostgres(config: TestConfig): Promise<number> {
  const pool = new Pool(config.postgres);
  try {
    const projectResult = await pool.query('SELECT id FROM projects WHERE project_path = $1', [config.testProjectPath]);
    if (projectResult.rows.length === 0) return 0;
    const projectId = projectResult.rows[0].id;
    let totalDeleted = 0;
    for (const table of ['semantic_search_embeddings', 'file_content_cache', 'initialization_progress', 'documentation_chunks', 'documentation_sources', 'project_platforms']) {
      try { const r = await pool.query('DELETE FROM ' + table + ' WHERE project_id = $1', [projectId]); totalDeleted += r.rowCount || 0; } catch (e) { /* ignore */ }
    }
    const deleteResult = await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    totalDeleted += deleteResult.rowCount || 0;
    return totalDeleted;
  } finally {
    await pool.end();
  }
}

async function cleanupNeo4j(config: TestConfig): Promise<number> {
  const driver: Driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));
  try {
    const session = driver.session();
    try {
      const result = await session.run('MATCH (n) WHERE n.projectPath STARTS WITH $path OR n.filePath STARTS WITH $path DETACH DELETE n RETURN count(n) as deleted', { path: config.testProjectPath });
      return result.records[0]?.get('deleted')?.toNumber() || 0;
    } finally { await session.close(); }
  } finally { await driver.close(); }
}

// ============================================================================
// Mock Claude Executor
// ============================================================================

export interface MockClaudeResponse { query: string; response: string; filesModified?: string[]; delay?: number; }

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

  addMockResponse(response: MockClaudeResponse): void { this.responses.unshift(response); }

  async execute(query: string): Promise<string> {
    const matchedResponse = this.responses.find(r => query.toLowerCase().includes(r.query.toLowerCase()) || new RegExp(r.query, 'i').test(query));
    if (!matchedResponse) {
      const defaultResponse = 'Processed: ' + query;
      this.executionLog.push({ query, response: defaultResponse, timestamp: new Date() });
      return defaultResponse;
    }
    if (matchedResponse.delay) await new Promise(resolve => setTimeout(resolve, matchedResponse.delay));
    this.executionLog.push({ query, response: matchedResponse.response, timestamp: new Date() });
    return matchedResponse.response;
  }

  getExecutionLog() { return [...this.executionLog]; }
  clearLog(): void { this.executionLog = []; }
}

// ============================================================================
// CodeMind CLI Executor
// ============================================================================

export interface CLIExecutionResult { stdout: string; stderr: string; exitCode: number; duration: number; }
export interface CLIExecutionOptions { timeout?: number; cwd?: string; env?: Record<string, string>; mockClaude?: MockClaudeExecutor; stdinInput?: string; }

export async function executeCodemind(args: string, options: CLIExecutionOptions = {}): Promise<CLIExecutionResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 120000;
  const cwd = options.cwd || DEFAULT_CONFIG.testProjectPath;
  const env = { ...process.env, ...options.env, ...(options.mockClaude ? { CODEMIND_MOCK_CLAUDE: 'true' } : {}) };

  return new Promise((resolve) => {
    const binPath = path.join(__dirname, '../../..', 'bin/codemind.js');
    const child = spawn('node', [binPath, ...args.split(' ').filter(a => a)], { cwd, env, shell: true });
    let stdout = '', stderr = '';
    let timeoutHandle: NodeJS.Timeout;

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    if (options.stdinInput) {
      setTimeout(() => { if (child.stdin) { child.stdin.write(options.stdinInput); child.stdin.end(); } }, 1000);
    }

    child.on('close', (code) => { clearTimeout(timeoutHandle); resolve({ stdout, stderr, exitCode: code || 0, duration: Date.now() - startTime }); });
    child.on('error', (error) => { clearTimeout(timeoutHandle); resolve({ stdout, stderr: stderr + '\n' + error.message, exitCode: 1, duration: Date.now() - startTime }); });
    timeoutHandle = setTimeout(() => { child.kill(); resolve({ stdout, stderr: stderr + '\nProcess timed out', exitCode: 124, duration: Date.now() - startTime }); }, timeout);
  });
}

export async function executeQuery(query: string, options: CLIExecutionOptions = {}): Promise<CLIExecutionResult> {
  return executeCodemind('-c "' + query.replace(/"/g, '\\"') + '"', options);
}

// ============================================================================
// Verification Helpers
// ============================================================================

export interface SearchResult { filesFound: string[]; enhancedPrompt: string; relationships: string[]; }
export interface DatabaseState { connected: boolean; recordCount: number; error?: string; }

export async function verifySearchResults(query: string, expectedPatterns: string[], config: TestConfig = DEFAULT_CONFIG): Promise<{ passed: boolean; details: string[] }> {
  const result = await executeQuery(query, { cwd: config.testProjectPath });
  const details: string[] = [];
  let allPassed = true;
  for (const pattern of expectedPatterns) {
    if (new RegExp(pattern, 'i').test(result.stdout)) { details.push('Found pattern: ' + pattern); } else { details.push('Missing pattern: ' + pattern); allPassed = false; }
  }
  return { passed: allPassed, details };
}

export async function verifyDatabaseState(config: TestConfig = DEFAULT_CONFIG): Promise<{ postgres: DatabaseState; neo4j: DatabaseState }> {
  return { postgres: await getPostgresState(config), neo4j: await getNeo4jState(config) };
}

async function getPostgresState(config: TestConfig): Promise<DatabaseState> {
  const pool = new Pool(config.postgres);
  try {
    const projectResult = await pool.query('SELECT id FROM projects WHERE project_path = $1', [config.testProjectPath]);
    if (projectResult.rows.length === 0) return { connected: true, recordCount: 0 };
    const projectId = projectResult.rows[0].id;
    const countResult = await pool.query('SELECT COUNT(*) as count FROM semantic_search_embeddings WHERE project_id = $1', [projectId]);
    return { connected: true, recordCount: parseInt(countResult.rows[0].count, 10) };
  } catch (error) { return { connected: false, recordCount: 0, error: String(error) }; }
  finally { await pool.end(); }
}

async function getNeo4jState(config: TestConfig): Promise<DatabaseState> {
  const driver: Driver = neo4j.driver(config.neo4j.uri, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));
  try {
    const session = driver.session();
    try {
      const result = await session.run('MATCH (n) WHERE n.projectPath STARTS WITH $path OR n.filePath STARTS WITH $path RETURN count(n) as count', { path: config.testProjectPath });
      return { connected: true, recordCount: result.records[0]?.get('count')?.toNumber() || 0 };
    } finally { await session.close(); }
  } catch (error) { return { connected: false, recordCount: 0, error: String(error) }; }
  finally { await driver.close(); }
}

export async function verifyFileExists(filePath: string): Promise<boolean> {
  try { await fsPromises.access(filePath); return true; } catch { return false; }
}

export async function verifyFileContains(filePath: string, patterns: string[]): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allPassed = true;
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    for (const pattern of patterns) {
      if (new RegExp(pattern, 'i').test(content)) { details.push('Found pattern: ' + pattern); } else { details.push('Missing pattern: ' + pattern); allPassed = false; }
    }
  } catch (error) { details.push('Failed to read file: ' + error); allPassed = false; }
  return { passed: allPassed, details };
}

// ============================================================================
// Test Assertion Helpers
// ============================================================================

export class TestAssertions {
  private failures: string[] = [];
  private testName: string = '';

  setTestName(name: string): void { this.testName = name; }
  assert(condition: boolean, message: string): void { if (!condition) this.failures.push('[' + this.testName + '] ' + message); }
  assertEqual<T>(actual: T, expected: T, message: string): void { if (actual !== expected) this.failures.push('[' + this.testName + '] ' + message + ': expected ' + expected + ', got ' + actual); }
  assertContains(text: string, pattern: string, message: string): void { if (!text.includes(pattern) && !new RegExp(pattern, 'i').test(text)) this.failures.push('[' + this.testName + '] ' + message + ': "' + pattern + '" not found'); }
  assertNotContains(text: string, pattern: string, message: string): void { if (text.includes(pattern) || new RegExp(pattern, 'i').test(text)) this.failures.push('[' + this.testName + '] ' + message + ': "' + pattern + '" was found'); }
  getFailures(): string[] { return [...this.failures]; }
  hasFailures(): boolean { return this.failures.length > 0; }
  clear(): void { this.failures = []; this.testName = ''; }
}

export const assertions = new TestAssertions();
