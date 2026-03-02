#!/usr/bin/env node
/**
 * Smoke Test for Consolidated MCP Tools (3-tool architecture)
 *
 * Tests the three consolidated tools against CodeSeeker itself:
 *   1. index  - status, init
 *   2. search - query, filepath, query+read
 *   3. analyze - dependencies, standards
 *
 * Usage:
 *   node scripts/smoke-test-mcp.js
 *   node scripts/smoke-test-mcp.js --quick   (skip indexing, only non-embedding tests)
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────
const CODESEEKER_ROOT = path.resolve(__dirname, '..');
const TEMP_DATA_DIR = path.join(os.tmpdir(), `cs-smoke-${Date.now()}`);
const QUICK = process.argv.includes('--quick');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

let passed = 0, failed = 0, skipped = 0;

function section(title) {
  console.log(`\n${c.bold}${c.blue}${'─'.repeat(60)}${c.reset}`);
  console.log(`${c.bold}${c.blue}  ${title}${c.reset}`);
  console.log(`${c.blue}${'─'.repeat(60)}${c.reset}`);
}

function check(label, result, expectFn) {
  try {
    let parsed;
    try {
      parsed = typeof result === 'string' ? JSON.parse(result) : result;
    } catch {
      parsed = result; // plain-text response - pass raw string to expectFn
    }
    const ok = expectFn(parsed);
    if (ok !== false) {
      console.log(`  ${c.green}✓${c.reset} ${label}`);
      passed++;
    } else {
      console.log(`  ${c.red}✗${c.reset} ${label}`);
      console.log(`    ${c.dim}Result: ${JSON.stringify(parsed, null, 2).split('\n').slice(0, 10).join('\n    ')}${c.reset}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ${c.red}✗${c.reset} ${label}`);
    console.log(`    ${c.red}Error: ${err.message}${c.reset}`);
    console.log(`    ${c.dim}Result was: ${String(result).substring(0, 200)}${c.reset}`);
    failed++;
  }
}

function skip(label, reason) {
  console.log(`  ${c.yellow}○${c.reset} ${c.dim}${label} (${reason})${c.reset}`);
  skipped++;
}

async function callHandler(server, name, params) {
  const fn = server[name].bind(server);
  const raw = await fn(params);
  const text = raw?.content?.[0]?.text;
  if (raw?.isError) {
    throw new Error(`Tool error: ${text}`);
  }
  return text;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.magenta}CodeSeeker MCP Smoke Test — 3-tool architecture${c.reset}`);
  console.log(`${c.dim}Target:    ${CODESEEKER_ROOT}${c.reset}`);
  console.log(`${c.dim}Data dir:  ${TEMP_DATA_DIR}${c.reset}`);
  console.log(`${c.dim}Mode:      ${QUICK ? 'quick (no indexing)' : 'full'}${c.reset}`);

  // ── Setup ──────────────────────────────────────────────────────────────────
  process.env.CODESEEKER_DATA_DIR = TEMP_DATA_DIR;
  process.env.CODESEEKER_STORAGE_MODE = 'embedded';

  const { resetStorageManager } = require('../dist/storage');
  await resetStorageManager();

  const { CodeSeekerMcpServer } = require('../dist/mcp/mcp-server');
  const server = new CodeSeekerMcpServer();

  // expose private handlers for testing
  const s = server;

  // ── TOOL: index - status ───────────────────────────────────────────────────
  section('TOOL: index  →  action: status');

  const statusResult = await callHandler(s, 'handleProjects', {});
  check('Returns a message when no projects indexed', statusResult, r => {
    return typeof r === 'string' && r.length > 0;
  });
  console.log(`  ${c.dim}→ ${statusResult.substring(0, 120)}${c.reset}`);

  // ── TOOL: index - init ─────────────────────────────────────────────────────
  section('TOOL: index  →  action: init');

  if (QUICK) {
    skip('Index CodeSeeker project', '--quick flag set');
  } else {
    const initResult = await callHandler(s, 'handleIndexInit', {
      path: CODESEEKER_ROOT,
      name: 'codeseeker-smoke',
    });
    const initData = JSON.parse(initResult);
    check('init starts indexing', initResult, d => d.status === 'indexing_started');
    check('init returns project_name', initResult, d => d.project_name === 'codeseeker-smoke');
    check('init returns project_path', initResult, d => !!d.project_path);
    console.log(`  ${c.dim}→ status: ${initData.status}${c.reset}`);
    console.log(`  ${c.dim}→ message: ${initData.message}${c.reset}`);

    // Wait briefly then check status again
    await new Promise(r => setTimeout(r, 500));
    const statusResult2 = await callHandler(s, 'handleProjects', {});
    check('status shows project after init', statusResult2, d => {
      try {
        const parsed = JSON.parse(statusResult2);
        return parsed.total_projects >= 1;
      } catch { return false; }
    });
  }

  // ── TOOL: index - invalid path ─────────────────────────────────────────────
  section('TOOL: index  →  action: init (validation)');

  try {
    await callHandler(s, 'handleIndexInit', { path: '/nonexistent/path/xyz' });
    console.log(`  ${c.red}✗${c.reset} Should have rejected nonexistent path`);
    failed++;
  } catch (err) {
    check('Rejects nonexistent path', err.message, m => m.includes('not found') || m.includes('Directory'));
  }

  try {
    await callHandler(s, 'handleIndexInit', { path: 'C:\\Windows\\System32' });
    console.log(`  ${c.red}✗${c.reset} Should have rejected system path`);
    failed++;
  } catch (err) {
    check('Rejects system/dangerous paths', err.message, m =>
      m.includes('Security') || m.includes('cannot index')
    );
  }

  const noPathResult = await s.handleIndexInit({});
  check('Rejects missing path param', noPathResult?.content?.[0]?.text, t =>
    t.includes('path parameter required') || t.includes('required')
  );

  // ── TOOL: index - parsers list ─────────────────────────────────────────────
  section('TOOL: index  →  action: parsers (list)');

  const parsersResult = await callHandler(s, 'handleInstallParsers', { list_available: true });
  check('Returns parser list', parsersResult, d => {
    const parsed = JSON.parse(parsersResult);
    return Array.isArray(parsed.installed_parsers) && Array.isArray(parsed.available_parsers);
  });
  const parsersData = JSON.parse(parsersResult);
  console.log(`  ${c.dim}→ Installed: ${parsersData.installed_parsers.length}, Available: ${parsersData.available_parsers.length}${c.reset}`);

  // ── TOOL: search - filepath (read-with-context) ─────────────────────────────
  section('TOOL: search  →  filepath mode (read-with-context)');

  const targetFile = path.join(CODESEEKER_ROOT, 'src', 'mcp', 'mcp-server.ts');
  const readRaw = await s.handleReadWithContext(targetFile, undefined, false);
  const readResult = readRaw?.content?.[0]?.text;
  check('Reads mcp-server.ts successfully', readResult, d => {
    const parsed = JSON.parse(readResult);
    return parsed.content && parsed.content.length > 100 && parsed.line_count > 50;
  });
  const readData = JSON.parse(readResult);
  check('File has correct relative path', readResult, d => {
    return readData.filepath.endsWith('mcp-server.ts');
  });
  check('Returns line count', readResult, d => typeof readData.line_count === 'number');
  console.log(`  ${c.dim}→ ${readData.filepath} (${readData.line_count} lines)${c.reset}`);

  // Read a small file
  const packageFile = path.join(CODESEEKER_ROOT, 'package.json');
  const pkgRaw = await s.handleReadWithContext(packageFile, undefined, false);
  const pkgResult = pkgRaw?.content?.[0]?.text;
  check('Reads package.json successfully', pkgResult, d => {
    const parsed = JSON.parse(pkgResult);
    return parsed.content.includes('"name"') && parsed.content.includes('codeseeker');
  });

  // Nonexistent file
  const badFileResult = await s.handleReadWithContext('/no/such/file.ts', undefined, false);
  check('Returns error for missing file', badFileResult?.content?.[0]?.text, t =>
    t.includes('not found') || t.includes('File not found')
  );

  // ── TOOL: analyze - no project (error path) ────────────────────────────────
  section('TOOL: analyze  →  error handling (no project)');

  const noProjectDepsResult = await s.handleShowDependencies({
    project: 'nonexistent-project-xyz',
    filepath: 'src/mcp/mcp-server.ts',
  });
  check('Returns error when project not found', noProjectDepsResult?.content?.[0]?.text, t =>
    t.includes('not indexed') || t.includes('not found') || noProjectDepsResult?.isError
  );

  const noProjectDupsResult = await s.handleFindDuplicates({
    project: 'nonexistent-project-xyz',
  });
  check('Duplicates returns error when project not found', noProjectDupsResult?.content?.[0]?.text, t =>
    t.includes('not found') || noProjectDupsResult?.isError
  );

  const noProjectDeadResult = await s.handleFindDeadCode({
    project: 'nonexistent-project-xyz',
  });
  check('Dead code returns error when project not found', noProjectDeadResult?.content?.[0]?.text, t =>
    t.includes('not found') || noProjectDeadResult?.isError
  );

  // ── TOOL: index - exclude (edge cases) ─────────────────────────────────────
  section('TOOL: index  →  action: exclude (validation)');

  const noProjectExclude = await s.handleExclude({ exclude_action: 'list' });
  check('Exclude requires project param', noProjectExclude?.content?.[0]?.text, t =>
    t.includes('project') && (t.includes('required') || t.includes('parameter'))
  );

  const noActionExclude = await s.handleExclude({ project: 'some-project' });
  check('Exclude requires exclude_action param', noActionExclude?.content?.[0]?.text, t =>
    t.includes('exclude_action')
  );

  // ── TOOL: index - exclude (not-found project) ──────────────────────────────
  const notFoundExclude = await s.handleExclude({
    project: 'nonexistent-project-xyz',
    exclude_action: 'list',
  });
  check('Exclude returns error for unknown project', notFoundExclude?.content?.[0]?.text, t =>
    t.includes('not found') || notFoundExclude?.isError
  );

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${'─'.repeat(60)}${c.reset}`);
  const total = passed + failed + skipped;
  const pct = total > 0 ? Math.round((passed / (total - skipped)) * 100) : 0;
  console.log(
    `${c.bold}Results: ` +
    `${c.green}${passed} passed${c.reset}  ` +
    `${c.red}${failed} failed${c.reset}  ` +
    `${c.yellow}${skipped} skipped${c.reset}  ` +
    `${c.dim}(${pct}%)\n`
  );

  // Cleanup
  try { fs.rmSync(TEMP_DATA_DIR, { recursive: true, force: true }); } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\n${c.red}Fatal error: ${err.message}${c.reset}`);
  console.error(err.stack);
  process.exit(1);
});
