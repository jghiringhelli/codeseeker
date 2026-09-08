/**
 * Does the MCP server keep stdout clean?
 *
 * stdout is the protocol channel. A single line of human-readable output on it corrupts
 * the JSON-RPC stream, and a strict client responds by closing the connection — which is
 * exactly the "CONNECTION_CLOSED" this session saw at launch.
 *
 * Drives a real server through a real indexing run, then reports every stdout line that
 * is not valid JSON-RPC.
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const SERVER = 'C:/workspace/PragmaWorks/mcp/CodeSeeker/dist/cli/codeseeker-cli.js';

// A tiny throwaway project — indexing is what triggers the noisy code paths.
const PROJ = path.join(os.tmpdir(), `cs-purity-${Date.now()}`);
fs.mkdirSync(path.join(PROJ, 'src'), { recursive: true });
fs.writeFileSync(path.join(PROJ, 'src', 'auth.ts'),
  `import validator from 'validator';\nexport class AuthService {\n  validate(email: string) { return validator.isEmail(email); }\n  login(u: string) { return this.validate(u); }\n}\n`);
fs.writeFileSync(path.join(PROJ, 'src', 'api.ts'),
  `export function handler(req: any, res: any) {\n  try { return res.status(200).json({ ok: true }); }\n  catch (e) { console.error(e); return res.status(500).json({ error: 'failed' }); }\n}\n`);

const p = spawn(process.execPath, [SERVER, 'serve', '--mcp'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, CODESEEKER_STORAGE_MODE: 'embedded' },
  shell: false,
});

let buf = '';
const dirty = [];
let clean = 0;
let stderrBytes = 0;
let id = 1;
const pending = new Map();

p.stderr.on('data', d => { stderrBytes += d.length; });

p.stdout.on('data', d => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.trim() === '') continue;
    let msg;
    try { msg = JSON.parse(line); } catch {
      dirty.push(line.slice(0, 120));
      continue;
    }
    if (msg.jsonrpc !== '2.0') { dirty.push(`non-jsonrpc: ${line.slice(0, 100)}`); continue; }
    clean++;
    const w = pending.get(msg.id);
    if (w) { pending.delete(msg.id); w(msg); }
  }
});

const rpc = (method, params) => new Promise(res => {
  const myId = id++;
  pending.set(myId, res);
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n');
});
const call = (args) => rpc('tools/call', { name: 'codeseeker', arguments: args });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'purity', version: '1' } });
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  await rpc('tools/list', {});

  await call({ action: 'index', index: { op: 'init', path: PROJ, name: 'purity-probe' } });

  // Indexing runs in the background; the noisy paths (standards generation) fire at the end.
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const r = await call({ action: 'index', index: { op: 'status' } });
    const t = r?.result?.content?.[0]?.text ?? '';
    if (/"indexing_status":\s*"completed"/.test(t)) break;
    if (/"indexing_status":\s*"failed"/.test(t)) break;
  }

  await call({ action: 'search', project: 'purity-probe', search: { q: 'validate an email address' } });
  await call({ action: 'analyze', project: 'purity-probe', analyze: { kind: 'standards' } });

  console.error('\n──────── stdout purity ────────');
  console.error(`  valid JSON-RPC messages : ${clean}`);
  console.error(`  stderr bytes (fine)     : ${stderrBytes}`);
  console.error(`  NON-PROTOCOL stdout lines: ${dirty.length}`);
  for (const d of dirty.slice(0, 15)) console.error(`     ✗ ${d}`);
  console.error(dirty.length === 0 ? '  VERDICT: clean' : '  VERDICT: PROTOCOL CORRUPTED');

  p.kill();
  try { fs.rmSync(PROJ, { recursive: true, force: true }); } catch {}
  process.exit(dirty.length === 0 ? 0 : 1);
})().catch(e => { console.error('fatal', e); p.kill(); process.exit(1); });
