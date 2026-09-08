#!/usr/bin/env node
/**
 * The install journey — what a new user actually experiences, start to finish.
 *
 * Every other check in this repository verifies a part. This one verifies the sequence:
 * a person adds the MCP config, restarts their editor, asks a question about their
 * codebase, and gets a useful answer. If any step in that chain is slow, silent, or
 * confusing, the tool has failed regardless of how well its internals test.
 *
 * Measures what the user feels — elapsed time per step — and asserts the things that
 * make the difference between "it works" and "it works and I understood what happened".
 *
 * Usage:
 *   node scripts/install-journey.js                 # against the local build
 *   node scripts/install-journey.js --npx           # against the published package
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const USE_NPX = process.argv.includes('--npx');

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
const steps = [];
function step(name, ok, detail, ms) {
  steps.push({ name, ok, detail, ms });
  const mark = ok === true ? `${c.green}✓${c.reset}` : ok === false ? `${c.red}✗${c.reset}` : `${c.yellow}—${c.reset}`;
  console.log(`  ${mark} ${c.bold}${name}${c.reset}${ms !== undefined ? ` ${c.dim}(${ms}ms)${c.reset}` : ''}\n      ${detail}`);
}

// A small but realistic project: a couple of modules that import each other, so the
// graph has something to say and search has something to disambiguate.
function makeProject() {
  const dir = path.join(os.tmpdir(), `cs-journey-${Date.now()}`);
  fs.mkdirSync(path.join(dir, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'api'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'jwt.ts'),
    `import { readSecret } from './secret';\n\n` +
    `export class JwtService {\n` +
    `  /** Verify a bearer token and return its subject. */\n` +
    `  verify(token: string): string | null {\n` +
    `    const secret = readSecret();\n` +
    `    if (!token || !secret) return null;\n` +
    `    return token.split('.')[1] ?? null;\n` +
    `  }\n` +
    `  refresh(oldToken: string): string {\n` +
    `    return oldToken + '.refreshed';\n` +
    `  }\n}\n`);
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'secret.ts'),
    `export function readSecret(): string {\n  return process.env.JWT_SECRET ?? '';\n}\n`);
  fs.writeFileSync(path.join(dir, 'src', 'api', 'middleware.ts'),
    `import { JwtService } from '../auth/jwt';\n\n` +
    `const jwt = new JwtService();\n\n` +
    `export function requireAuth(req: any, res: any, next: any) {\n` +
    `  const subject = jwt.verify(req.headers.authorization);\n` +
    `  if (!subject) return res.status(401).json({ error: 'unauthorized' });\n` +
    `  req.user = subject;\n  return next();\n}\n`);
  return dir;
}

class Client {
  constructor() { this.buf = ''; this.stderr = ''; this.dirty = []; this.id = 1; this.pending = new Map(); }
  start() {
    const [cmd, args] = USE_NPX
      ? ['npx', ['-y', 'codeseeker', 'serve', '--mcp']]
      : [process.execPath, [path.join(ROOT, 'dist', 'cli', 'codeseeker-cli.js'), 'serve', '--mcp']];
    this.t0 = Date.now();
    // Run from a neutral directory, for two reasons. First, `npx codeseeker` launched
    // from inside this repository resolves to the *local* package — npm sees a
    // package.json declaring that bin — so a --npx run started here silently tests the
    // working tree and reports it as the published package. Second, R3 says no action
    // may depend on the server's working directory, and starting somewhere unrelated is
    // the honest way to hold that.
    const neutralCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-journey-cwd-'));
    this.neutralCwd = neutralCwd;
    this.p = spawn(cmd, args, {
      cwd: neutralCwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CODESEEKER_STORAGE_MODE: 'embedded' },
      shell: process.platform === 'win32' && USE_NPX,
    });
    this.p.stderr.on('data', d => { this.stderr += d.toString(); });
    this.p.stdout.on('data', d => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        let m;
        try { m = JSON.parse(line); } catch { this.dirty.push(line.slice(0, 120)); continue; }
        if (m.jsonrpc !== '2.0') { this.dirty.push(line.slice(0, 120)); continue; }
        const w = this.pending.get(m.id);
        if (w) { this.pending.delete(m.id); w(m); }
      }
    });
    return this.rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'journey', version: '1' } })
      .then(r => { this.p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n'); return r; });
  }
  rpc(method, params) {
    return new Promise((res, rej) => {
      const myId = this.id++;
      const timer = setTimeout(() => rej(new Error(`${method} timed out`)), 120000);
      this.pending.set(myId, m => { clearTimeout(timer); res(m); });
      this.p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n');
    });
  }
  call(args) { return this.rpc('tools/call', { name: 'codeseeker', arguments: args }); }
  text(r) { return r?.result?.content?.[0]?.text ?? ''; }
  stop() { try { this.p.kill(); } catch {} try { fs.rmSync(this.neutralCwd, { recursive: true, force: true }); } catch {} }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(`\n${c.bold}${c.cyan}━━━ install journey (${USE_NPX ? 'published package via npx' : 'local build'}) ━━━${c.reset}\n`);
  const proj = makeProject();
  const cli = new Client();

  // 1 — the editor starts the server and completes a handshake
  let t = Date.now();
  await cli.start();
  const startMs = Date.now() - t;
  step('server starts and answers initialize', startMs < 15000, `${startMs}ms — a client that waits less than this reports "connection closed"`, startMs);

  // 2 — the assistant discovers what it can do
  t = Date.now();
  const tools = (await cli.rpc('tools/list', {})).result.tools;
  step('exposes exactly one tool', tools.length === 1 && tools[0].name === 'codeseeker',
    `${tools.length} tool(s): ${tools.map(x => x.name).join(', ')} — description ${tools[0].description.length} chars`, Date.now() - t);

  // 3 — the user asks before indexing. The answer must teach, not just refuse.
  t = Date.now();
  const premature = cli.text(await cli.call({ action: 'search', project: proj, search: { q: 'how does auth work' } }));
  const teaches = /index/i.test(premature) && /init/i.test(premature);
  step('an un-indexed query explains the fix', teaches, teaches ? `names the init call: "${premature.slice(0, 90)}…"` : `unhelpful: "${premature.slice(0, 110)}"`, Date.now() - t);

  // 4 — indexing
  t = Date.now();
  const init = JSON.parse(cli.text(await cli.call({ action: 'index', index: { op: 'init', path: proj, name: 'journey' } })));
  step('index starts without blocking', init.status === 'indexing_started', `returned immediately: ${init.status}`, Date.now() - t);

  t = Date.now();
  let done = false, files = 0;
  for (let i = 0; i < 60 && !done; i++) {
    await sleep(2000);
    const st = JSON.parse(cli.text(await cli.call({ action: 'index', index: { op: 'status' } })));
    const p = (st.projects || []).find(x => x.name === 'journey');
    if (p?.indexing_status === 'completed') { done = true; files = p.indexing_result?.filesIndexed ?? 0; }
  }
  const indexMs = Date.now() - t;
  step('indexing completes and reports what it did', done, done ? `${files} files in ${(indexMs / 1000).toFixed(1)}s` : 'never reported completed', indexMs);

  // 5 — the question the user actually came to ask
  t = Date.now();
  const searchRaw = cli.text(await cli.call({ action: 'search', project: 'journey', search: { q: 'verify a bearer token' } }));
  let hit = null, rel = false;
  try {
    const r = JSON.parse(searchRaw);
    hit = r.results?.[0];
    rel = !!hit && !path.isAbsolute(hit.file) && fs.existsSync(path.join(proj, hit.file));
  } catch {}
  const foundRight = hit && /jwt\.ts$/.test(hit.file.replace(/\\/g, '/'));
  step('finds the right file for a natural-language question', !!foundRight,
    hit ? `top hit: ${hit.file} (score ${hit.score})` : `no results: ${searchRaw.slice(0, 100)}`, Date.now() - t);
  step('paths are usable without transformation', rel, rel ? 'project-relative and present on disk' : 'absolute or missing');

  // 6 — the follow-up question: what breaks if I change it
  t = Date.now();
  const graphRaw = cli.text(await cli.call({ action: 'graph', project: 'journey', graph: { seed: 'src/auth/jwt.ts', dir: 'in' } }));
  const knowsCaller = /middleware/.test(graphRaw);
  step('answers "what depends on this"', knowsCaller, knowsCaller ? 'found the middleware that imports jwt.ts' : `did not: ${graphRaw.slice(0, 120)}`, Date.now() - t);

  // 7 — a typo. Must be diagnosable, per R19.
  t = Date.now();
  const typo = cli.text(await cli.call({ action: 'graph', project: 'journey', graph: { seed: 'src/auth/jwtt.ts' } }));
  const diagnosable = /indexed_file_count/.test(typo) && /did_you_mean|sample/.test(typo);
  step('a mistyped path is diagnosable', diagnosable, diagnosable ? 'reports the indexed count and suggests candidates' : `bare error: ${typo.slice(0, 120)}`, Date.now() - t);

  // 8 — the property that makes all of the above possible
  step('stdout carried protocol only', cli.dirty.length === 0,
    cli.dirty.length === 0 ? 'no human-readable output on the protocol channel' : `${cli.dirty.length} polluted line(s): ${cli.dirty[0]}`);

  cli.stop();
  try { fs.rmSync(proj, { recursive: true, force: true }); } catch {}

  const failed = steps.filter(s => s.ok === false);
  console.log(`\n  ${c.green}${steps.length - failed.length} passed${c.reset}  ${failed.length ? c.red : c.dim}${failed.length} failed${c.reset}`);
  if (failed.length) { console.log(`\n${c.bold}failed steps${c.reset}`); failed.forEach(s => console.log(`  ${c.red}${s.name}${c.reset} — ${s.detail}`)); }

  const outDir = path.join(ROOT, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'install-journey.json'), JSON.stringify({ mode: USE_NPX ? 'npx' : 'local', generatedAt: new Date().toISOString(), steps }, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('fatal:', e.message); process.exit(1); });
