#!/usr/bin/env node
/**
 * What each MCP server costs you before it has done anything.
 *
 * Every tool a server exposes is re-sent on every request: its name, its description and
 * its full JSON schema all sit in the model's context for the whole session. A server with
 * 30 tools and generous prose can cost more context than the answer it eventually gives.
 *
 * This measures that surface for any set of configured servers, so a claim like "our tools
 * are consolidated and cheap" is a number rather than an opinion.
 *
 * Usage:
 *   node scripts/mcp-surface.js                    # every server in ~/.claude.json
 *   node scripts/mcp-surface.js codeseeker context7
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

/** Rough but consistent: ~4 characters per token is the usual English/JSON approximation. */
const tokens = (chars) => Math.round(chars / 4);

function configuredServers() {
  const file = path.join(os.homedir(), '.claude.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return cfg.mcpServers || {};
}

/** Speak just enough MCP to get `tools/list` back, then stop. */
function listTools(name, spec, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args || [], {
      env: { ...process.env, ...(spec.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let buf = '';
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* already gone */ }
      resolve(result);
    };

    child.stdout.on('data', (d) => {
      buf += d.toString();
      for (const line of buf.split('\n')) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 2 && msg.result?.tools) done({ name, tools: msg.result.tools });
      }
    });
    child.on('error', (e) => done({ name, error: e.message }));

    const send = (o) => { try { child.stdin.write(JSON.stringify(o) + '\n'); } catch { /* closed */ } };
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'surface', version: '1' } } });
    setTimeout(() => send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }), 3000);
    setTimeout(() => done({ name, error: `no tools/list within ${timeoutMs / 1000}s` }), timeoutMs);
  });
}

function measure(tools) {
  let descChars = 0;
  let schemaChars = 0;
  let nameChars = 0;
  const perTool = [];

  for (const t of tools) {
    const d = (t.description || '').length;
    const sch = JSON.stringify(t.inputSchema || {}).length;
    descChars += d;
    schemaChars += sch;
    nameChars += (t.name || '').length;
    perTool.push({ name: t.name, desc: d, schema: sch });
  }
  return { descChars, schemaChars, nameChars, total: descChars + schemaChars + nameChars, perTool };
}

(async () => {
  const wanted = process.argv.slice(2);
  const servers = configuredServers();
  const names = Object.keys(servers).filter(n => !wanted.length || wanted.includes(n));

  console.log(`\n${c.bold}${c.cyan}━━━ MCP surface cost ━━━${c.reset}`);
  console.log(`${c.dim}Every tool's name, description and schema is re-sent on every request.${c.reset}\n`);

  const rows = [];
  for (const name of names) {
    const r = await listTools(name, servers[name]);
    if (r.error) {
      console.log(`  ${c.red}skip${c.reset} ${name.padEnd(14)} ${c.dim}${r.error}${c.reset}`);
      continue;
    }
    const m = measure(r.tools);
    rows.push({ name, count: r.tools.length, ...m });
  }

  rows.sort((a, b) => b.total - a.total);

  console.log(`  ${'server'.padEnd(14)} ${'tools'.padStart(5)} ${'desc'.padStart(7)} ${'schema'.padStart(7)} ${'total'.padStart(7)} ${'~tokens'.padStart(8)}`);
  console.log(`  ${'-'.repeat(14)} ${'-'.repeat(5)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(8)}`);
  let grand = 0;
  for (const r of rows) {
    grand += r.total;
    const colour = r.total > 8000 ? c.red : r.total > 3000 ? c.yellow : c.green;
    console.log(`  ${r.name.padEnd(14)} ${String(r.count).padStart(5)} ${String(r.descChars).padStart(7)} `
      + `${String(r.schemaChars).padStart(7)} ${colour}${String(r.total).padStart(7)}${c.reset} ${String(tokens(r.total)).padStart(8)}`);
  }
  console.log(`  ${'-'.repeat(14)} ${'-'.repeat(5)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(7)} ${'-'.repeat(8)}`);
  console.log(`  ${c.bold}${'all'.padEnd(14)} ${String(rows.reduce((s, r) => s + r.count, 0)).padStart(5)} `
    + `${' '.repeat(7)} ${' '.repeat(7)} ${String(grand).padStart(7)} ${String(tokens(grand)).padStart(8)}${c.reset}`);

  console.log(`\n${c.bold}  widest descriptions${c.reset} ${c.dim}(the ones worth trimming first)${c.reset}`);
  const all = rows.flatMap(r => r.perTool.map(t => ({ ...t, server: r.name })));
  for (const t of all.sort((a, b) => b.desc - a.desc).slice(0, 12)) {
    console.log(`    ${String(t.desc).padStart(5)} chars  ${c.dim}${t.server}${c.reset} ${t.name}`);
  }

  console.log(`\n${c.bold}  cost per tool${c.reset} ${c.dim}(consolidation shows up here)${c.reset}`);
  for (const r of rows) {
    console.log(`    ${r.name.padEnd(14)} ${String(Math.round(r.total / r.count)).padStart(6)} chars/tool`);
  }
  console.log('');
  process.exit(0);
})();
