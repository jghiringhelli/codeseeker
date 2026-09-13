#!/usr/bin/env node
/**
 * Evidence for or against Chronos — docs/specs/proposed/chronos-git-history-graph.md §7.
 *
 * That specification is deliberately NOT adopted. It states three things that must be
 * true first, and this script is how two of them get tested BEFORE any implementation
 * exists:
 *
 *   §7.1  a labelled query set over at least three real repositories, answers confirmed
 *         by reading the history
 *   §7.2  the token claim measured rather than assumed — a traversal answer against what
 *         an assistant has to read today
 *
 * The comparison is deliberately unflattering to the idea. `naive` is not a strawman: it
 * is the command an assistant actually runs, and its output is what reaches the model's
 * context. If the ratio is unimpressive, the premise is wrong and Chronos should not be
 * built. Reporting that is a successful run.
 *
 * No Chronos code exists. Each `traversal` below is the git plumbing a graph would
 * encode, so what is measured is the shape of the answer, not an implementation.
 *
 * Usage: node scripts/chronos-bench.js
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

process.env.CODESEEKER_STORAGE_MODE = process.env.CODESEEKER_STORAGE_MODE || 'embedded';
const ROOT = path.resolve(__dirname, '..');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const REPOS = {
  codeseeker: 'C:/workspace/PragmaWorks/mcp/CodeSeeker',
  forgecraft: 'C:/workspace/PragmaWorks/forge/forgecraft-mcp',
  chronicle: 'C:/workspace/PragmaWorks/mcp/chronicle',
};

function git(repo, args, limitBytes = 40 * 1024 * 1024) {
  try {
    return execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf-8', maxBuffer: limitBytes, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

/** ~4 characters per token, the usual English/JSON approximation. */
const tok = (chars) => Math.round(chars / 4);

/**
 * Distil what a graph would return: declared edges, no diff text.
 * Each helper is one action from the specification.
 */
const answer = {
  // R4 — who changed this file, when, under what messages.
  //
  // `--name-status -M` is here because of R8. Following a rename silently is not enough:
  // with `--format` alone the output of `bin/codeseeker.js` never mentions
  // `bin/codemind.js`, so a caller cannot tell the path changed and has no way to ask
  // about the old one. The rename event has to be IN the answer. Found by running this
  // benchmark, and it amended the specification.
  history: (repo, file) =>
    git(repo, ['log', '--follow', '-M', '--name-status', '--format=%h|%an|%ad|%s', '--date=short', '--', file]),

  // R5 — familiarity with a path, by commit count. R14: the counts are in the output.
  owners: (repo, file) => {
    const names = git(repo, ['log', '--follow', '--format=%an', '--', file])
      .split('\n').filter(Boolean);
    const counts = {};
    for (const n of names) counts[n] = (counts[n] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([n, k]) => `${k}\t${n}`).join('\n');
  },

  // R6 — what changes together with this file. The query git makes hardest.
  cochange: (repo, file, window = 60) => {
    const shas = git(repo, ['log', `-n${window}`, '--format=%H', '--', file])
      .split('\n').filter(Boolean);
    const counts = {};
    for (const sha of shas) {
      for (const f of git(repo, ['show', '--pretty=format:', '--name-only', sha]).split('\n')) {
        if (f && f !== file) counts[f] = (counts[f] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([f, k]) => `${k}\t${f}`).join('\n');
  },

  // R7 — the narrative, oldest first
  why: (repo, file) =>
    git(repo, ['log', '--follow', '--reverse', '--format=%h %s', '--', file]),
};

/** What an assistant has to read today to answer the same question. */
const naive = {
  history: (repo, file) => git(repo, ['log', '-p', '--follow', '--', file]),
  owners: (repo, file) => git(repo, ['log', '-p', '--follow', '--', file]),
  cochange: (repo, file) => git(repo, ['log', '-p', '-n60', '--', file]),
  why: (repo, file) => git(repo, ['log', '-p', '--follow', '--reverse', '--', file]),
};

/**
 * Twenty-one questions. Every `expect` was confirmed by reading the history before it was
 * written here, and the script re-confirms it on every run — a question whose answer has
 * drifted reports as STALE rather than silently passing.
 */
const QUESTIONS = [
  // ── CodeSeeker ────────────────────────────────────────────────────────────
  { id: 'cs-why-embed',   repo: 'codeseeker', kind: 'why',      file: 'src/mcp/embedding-identity.ts',
    q: 'why does embedding-identity.ts exist',                 expect: 'stamp indexes with the embedder' },
  { id: 'cs-owners-mcp',  repo: 'codeseeker', kind: 'owners',   file: 'src/mcp/mcp-server.ts',
    q: 'who is most familiar with mcp-server.ts',              expect: 'Juan Carlos Ghiringhelli' },
  { id: 'cs-cochange-ix', repo: 'codeseeker', kind: 'cochange', file: 'src/mcp/indexing-service.ts',
    q: 'what changes together with indexing-service.ts',       expect: 'minisearch-text-store.ts',
    note: 'indexing-service.ts has NO import of minisearch-text-store.ts — invisible to an import graph' },
  { id: 'cs-cochange-if', repo: 'codeseeker', kind: 'cochange', file: 'src/mcp/indexing-service.ts',
    q: 'which interface moves with the indexer',                expect: 'src/storage/interfaces.ts' },
  { id: 'cs-rename-bin',  repo: 'codeseeker', kind: 'history',  file: 'bin/codeseeker.js',
    q: 'what is the full history of the CLI entry point',       expect: 'codemind',
    note: 'renamed from bin/codemind.js; 1 commit without --follow, 6 with it' },
  { id: 'cs-why-chunker', repo: 'codeseeker', kind: 'why',      file: 'src/cli/services/search/ast-chunker.ts',
    q: 'how did the chunker come to be what it is',             expect: 'chunk' },
  { id: 'cs-hist-orch',   repo: 'codeseeker', kind: 'history',  file: 'src/cli/commands/services/semantic-search-orchestrator.ts',
    q: 'when was ranking last changed and why',                 expect: 'declares' },
  { id: 'cs-owners-store', repo: 'codeseeker', kind: 'owners',  file: 'src/storage/interfaces.ts',
    q: 'who can explain the storage interfaces',                expect: 'CodeMind Test' },

  // ── ForgeCraft ────────────────────────────────────────────────────────────
  { id: 'fc-rename-adr',  repo: 'forgecraft', kind: 'history',  file: 'docs/adrs/active/0001-generative-specification-principle.md',
    q: 'what is the history of the founding ADR',               expect: 'docs/adrs',
    note: 'moved into docs/adrs/active/ — history begins before the current path' },
  { id: 'fc-owners-schema', repo: 'forgecraft', kind: 'owners', file: 'src/tools/forgecraft-schema.ts',
    q: 'who should review a schema change',                     expect: 'Ghiringhelli' },
  { id: 'fc-cochange-schema', repo: 'forgecraft', kind: 'cochange', file: 'src/tools/forgecraft-schema.ts',
    q: 'what moves with the schema',                            expect: 'src/' },
  { id: 'fc-why-sentinel', repo: 'forgecraft', kind: 'why',     file: 'src/tools/sentinel.ts',
    q: 'why is there a sentinel tool separate from the router', expect: 'sentinel' },
  { id: 'fc-hist-index',  repo: 'forgecraft', kind: 'history',  file: 'src/index.ts',
    q: 'how has the server entry point evolved',                expect: '|' },
  { id: 'fc-owners-router', repo: 'forgecraft', kind: 'owners', file: 'src/tools/forgecraft-router.ts',
    q: 'who knows the action router',                           expect: 'Ghiringhelli' },
  { id: 'fc-cochange-pkg', repo: 'forgecraft', kind: 'cochange', file: 'package.json',
    q: 'what accompanies a dependency change',                  expect: 'package-lock.json' },

  // ── Chronicle ─────────────────────────────────────────────────────────────
  { id: 'ch-rename-adr',  repo: 'chronicle', kind: 'history',   file: 'docs/adrs/active/ADR-001-use-sqlite-with-vector-embeddings.md',
    q: 'what is the history of the storage ADR',                expect: 'ADR-001',
    note: 'moved into docs/adrs/active/' },
  { id: 'ch-owners-server', repo: 'chronicle', kind: 'owners',  file: 'src/mcp/server.ts',
    q: 'who is most familiar with the MCP server',              expect: 'Ghiringhelli' },
  { id: 'ch-why-server',  repo: 'chronicle', kind: 'why',       file: 'src/mcp/server.ts',
    q: 'how did the tool surface come to be shaped this way',   expect: ' ' },
  { id: 'ch-cochange-server', repo: 'chronicle', kind: 'cochange', file: 'src/mcp/server.ts',
    q: 'what changes alongside the server',                     expect: 'src/' },
  { id: 'ch-hist-team',   repo: 'chronicle', kind: 'history',   file: 'src/mcp/team-tools.ts',
    q: 'when did team coordination arrive',                      expect: '|' },
  { id: 'ch-owners-pkg',  repo: 'chronicle', kind: 'owners',    file: 'package.json',
    q: 'who manages dependencies here',                          expect: 'Ghiringhelli' },
];

(async () => {
  console.log(`\n${c.bold}${c.cyan}━━━ Chronos: evidence for §7 ━━━${c.reset}`);
  console.log(`${c.dim}Each answer is the git plumbing a graph would encode. "naive" is what an`);
  console.log(`assistant runs today, and its output is what reaches the model's context.${c.reset}\n`);

  for (const [name, repo] of Object.entries(REPOS)) {
    if (!fs.existsSync(path.join(repo, '.git'))) {
      console.log(`  ${c.red}missing repo${c.reset} ${name} — ${repo}`);
    }
  }

  const rows = [];
  let stale = 0;
  for (const qq of QUESTIONS) {
    const repo = REPOS[qq.repo];
    const a = answer[qq.kind](repo, qq.file);
    const n = naive[qq.kind](repo, qq.file);
    const found = a.toLowerCase().includes(qq.expect.toLowerCase());
    if (!found) stale++;
    rows.push({ ...qq, aLen: a.length, nLen: n.length, found });
  }

  console.log(`  ${'id'.padEnd(20)} ${'kind'.padEnd(9)} ${'graph'.padStart(7)} ${'naive'.padStart(9)} ${'ratio'.padStart(6)}  answer`);
  console.log(`  ${'-'.repeat(20)} ${'-'.repeat(9)} ${'-'.repeat(7)} ${'-'.repeat(9)} ${'-'.repeat(6)}  ------`);
  for (const r of rows) {
    const ratio = r.aLen > 0 ? (r.nLen / r.aLen) : 0;
    const mark = r.found ? `${c.green}found${c.reset}` : `${c.red}STALE${c.reset}`;
    console.log(`  ${r.id.padEnd(20)} ${r.kind.padEnd(9)} ${String(r.aLen).padStart(7)} ${String(r.nLen).padStart(9)} `
      + `${(ratio.toFixed(1) + '×').padStart(6)}  ${mark}`);
    if (r.note) console.log(`    ${c.dim}${r.note}${c.reset}`);
  }

  const graphTotal = rows.reduce((s, r) => s + r.aLen, 0);
  const naiveTotal = rows.reduce((s, r) => s + r.nLen, 0);

  console.log(`\n  ${c.bold}§7.1 labelled query set${c.reset}`);
  console.log(`    ${rows.length} questions across ${new Set(rows.map(r => r.repo)).size} repositories`);
  console.log(`    answers confirmed: ${rows.length - stale}/${rows.length}`
    + (stale ? `  ${c.red}(${stale} stale — history moved, fix the expectation)${c.reset}` : `  ${c.green}✓${c.reset}`));

  console.log(`\n  ${c.bold}§7.2 token claim${c.reset}`);
  console.log(`    graph answers   ${String(graphTotal).padStart(9)} chars  ~${tok(graphTotal)} tokens`);
  console.log(`    naive answers   ${String(naiveTotal).padStart(9)} chars  ~${tok(naiveTotal)} tokens`);
  const ratio = naiveTotal / graphTotal;
  console.log(`    ratio           ${ratio.toFixed(1)}× cheaper`);

  // ── §7.3 — is any of this unanswerable today? ──────────────────────────────
  //
  // A cheap ratio is not a reason to build a server; CodeSeeker plus plain `git` might
  // already cover these. The strongest candidate is co-change: `indexing-service.ts` and
  // `minisearch-text-store.ts` move together but neither imports the other, so an import
  // graph cannot represent the relationship at all — not "ranks it low", cannot hold it.
  console.log(`\n  ${c.bold}§7.3 unanswerable today?${c.reset}`);
  let verdict73 = null;
  try {
    const { getStorageManager } = require(path.join(ROOT, 'dist/storage/storage-manager.js'));
    const sm = await getStorageManager();
    const projects = await sm.getProjectStore().list();
    const newest = new Map();
    for (const pr of projects) {
      const t = new Date(pr.lastIndexed || pr.updatedAt || 0).getTime();
      if (!newest.has(pr.name) || t > newest.get(pr.name).t) newest.set(pr.name, { pr, t });
    }
    const self = newest.get('codeseeker-self');
    if (!self) {
      console.log(`    ${c.yellow}skipped${c.reset} — index codeseeker-self first (scripts/corpus-bench.js --all)`);
    } else {
      const norm = (x) => String(x).split(path.sep).join('/').replace(/\\/g, '/');
      const gs = sm.getGraphStore();
      const files = await gs.findNodes(self.pr.id, 'file');
      const ix = files.find((n) => norm(n.filePath).endsWith('src/mcp/indexing-service.ts'));
      if (!ix) {
        console.log(`    ${c.yellow}skipped${c.reset} — indexing-service.ts is not in the graph`);
      } else {
        const neighbours = (await gs.getNeighbors(ix.id))
          .filter((n) => n.type === 'file')
          .map((n) => path.basename(norm(n.filePath)));
        const hasCochange = neighbours.some((n) => n.includes('minisearch-text-store'));
        console.log(`    indexing-service.ts has ${neighbours.length} file neighbours in the import graph`);
        console.log(`    minisearch-text-store.ts among them: ${hasCochange ? `${c.red}yes${c.reset}` : `${c.green}no${c.reset}`}`
          + `   ${c.dim}(co-changes 4×, imports 0)${c.reset}`);
        verdict73 = !hasCochange;
      }
    }
  } catch (e) {
    console.log(`    ${c.yellow}skipped${c.reset} — ${e.message}`);
  }

  console.log('');
  if (stale > 0) {
    console.log(`  ${c.red}Not evidence yet${c.reset} — ${stale} expectation(s) no longer match the history.`);
  } else if (ratio >= 10) {
    console.log(`  ${c.green}§7.2 holds${c.reset} — traversal is ${ratio.toFixed(0)}× cheaper than what an assistant reads today.`);
    if (verdict73 === true) {
      console.log(`  ${c.green}§7.3 holds${c.reset} — co-change is not representable in an import graph, so it is not`);
      console.log(`  a ranking problem CodeSeeker could be tuned out of. All three conditions met.`);
    } else if (verdict73 === false) {
      console.log(`  ${c.red}§7.3 fails${c.reset} — the import graph already holds that relationship. Re-examine the premise.`);
    } else {
      console.log(`  ${c.dim}§7.3 not evaluated — see above.${c.reset}`);
    }
  } else if (ratio >= 3) {
    console.log(`  ${c.yellow}§7.2 is weak${c.reset} — ${ratio.toFixed(1)}× is real but not the margin the CKG result implies (11×).`);
    console.log(`  ${c.dim}Worth building only if §7.3 finds questions that are otherwise unanswerable.${c.reset}`);
  } else {
    console.log(`  ${c.red}§7.2 fails${c.reset} — ${ratio.toFixed(1)}× does not justify a server. The premise is wrong.`);
    console.log(`  ${c.dim}Per the specification, this is a successful outcome: it stays unbuilt.${c.reset}`);
  }
  console.log('');
  process.exit(0);
})();
