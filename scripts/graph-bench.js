#!/usr/bin/env node
/**
 * Does graph expansion actually retrieve anything?
 *
 * `scripts/real-bench.js` reports identical numbers for no-graph, graph-1hop, graph-2hop
 * and no-raptor across all 23 of its queries. That is not evidence that expansion does
 * nothing — its corpora are 41 to 51 files and its R@5 is already 100%, so there is no
 * headroom for expansion to show anything. The instrument cannot see the feature.
 *
 * This asks a question that instrument cannot: can search reach a file that the query
 * does not name?
 *
 * Every query below has a multi-file answer, and at least one target is LEXICALLY SILENT —
 * it contains none of the query's distinctive terms, so neither BM25 nor a semantic match
 * on those terms can surface it. It is reachable only by following an import edge from a
 * file that is not silent. The script verifies that silence mechanically and prints it, so
 * a query that stops being a graph test says so instead of quietly becoming an easy one.
 *
 * Usage: node scripts/graph-bench.js
 * Reads corpus locations from scripts/corpus.json; missing corpora are skipped.
 */

process.env.CODESEEKER_STORAGE_MODE = process.env.CODESEEKER_STORAGE_MODE || 'embedded';

const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const { getStorageManager } = require(path.join(ROOT, 'dist/storage/storage-manager.js'));
const { SemanticSearchOrchestrator } = require(path.join(ROOT, 'dist/cli/commands/services/semantic-search-orchestrator.js'));

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

/**
 * Words too common in code to make a target "lexically present". Without this every file
 * counts as containing the query, because every file contains `const` and `return`.
 */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'from', 'that', 'this', 'with', 'into', 'its', 'it', 'a', 'an',
  'is', 'are', 'was', 'has', 'have', 'not', 'but', 'all', 'any', 'can', 'get', 'set',
  'return', 'const', 'let', 'var', 'function', 'class', 'import', 'export', 'default',
  'what', 'where', 'which', 'when', 'how', 'does', 'do', 'to', 'of', 'in', 'on', 'by',
  'at', 'as', 'or', 'if', 'else', 'new', 'use', 'used', 'uses', 'file', 'files', 'code',
]);

const QUERIES = [
  // ── React / Redux ───────────────────────────────────────────────────────────
  {
    corpus: 'realworld-react-redux',
    id: 'rx-comment-tree',
    query: 'render the list of comments beneath an article',
    // CommentList is named by the query; Comment.js renders each one and DeleteButton
    // hangs off Comment. Neither mentions "list" or "article".
    mustFind: ['src/components/Article/CommentList.js', 'src/components/Article/Comment.js'],
  },
  {
    corpus: 'realworld-react-redux',
    id: 'rx-comment-delete',
    query: 'let the author remove one of their own comments',
    mustFind: ['src/components/Article/DeleteButton.js', 'src/components/Article/Comment.js'],
  },
  {
    corpus: 'realworld-react-redux',
    id: 'rx-tab-feed',
    query: 'switching between the global feed and your own feed on the home page',
    mustFind: ['src/components/Home/MainView.js', 'src/components/ArticleList.js'],
  },
  {
    corpus: 'realworld-react-redux',
    id: 'rx-article-body',
    query: 'show a single article with its author and markdown body',
    mustFind: ['src/components/Article/index.js', 'src/components/Article/ArticleMeta.js'],
  },

  // ── Express / TypeScript ────────────────────────────────────────────────────
  {
    corpus: 'realworld-node-express',
    id: 'ex-profile-shape',
    query: 'decide whether the current user already follows a profile',
    // profile.utils.ts computes `following`; it never says "current user" or "follows".
    mustFind: [
      'src/app/routes/profile/profile.service.ts',
      'src/app/routes/profile/profile.utils.ts',
    ],
  },
  {
    corpus: 'realworld-node-express',
    id: 'ex-error-shape',
    query: 'return a 422 when an article slug does not exist',
    mustFind: [
      'src/app/routes/article/article.service.ts',
      'src/app/models/http-exception.model.ts',
    ],
  },
  {
    corpus: 'realworld-node-express',
    id: 'ex-author-embed',
    query: 'embed the author of an article in the response payload',
    mustFind: [
      'src/app/routes/article/article.mapper.ts',
      'src/app/routes/article/author.mapper.ts',
    ],
  },

  // ── Django / Python ─────────────────────────────────────────────────────────
  {
    corpus: 'realworld-django',
    id: 'py-article-payload',
    query: 'which fields of an article are exposed by the REST API',
    mustFind: ['conduit/apps/articles/serializers.py', 'conduit/apps/articles/models.py'],
  },
  {
    corpus: 'realworld-django',
    id: 'py-tag-write',
    query: 'accept a list of tags when creating an article',
    mustFind: ['conduit/apps/articles/relations.py', 'conduit/apps/articles/serializers.py'],
  },
  {
    corpus: 'realworld-django',
    id: 'py-auth-chain',
    query: 'reject a request whose authorization header is malformed',
    mustFind: ['conduit/apps/authentication/backends.py', 'conduit/apps/core/exceptions.py'],
  },
];

function distinctiveTerms(query) {
  return query.toLowerCase().split(/\W+/).filter(t => t.length > 3 && !STOPWORDS.has(t));
}

/** Does this file contain any distinctive term of the query, in its text or its path? */
function lexicallyPresent(rootPath, relPath, terms) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(rootPath, relPath), 'utf-8').toLowerCase();
  } catch {
    return null; // file missing — the query is stale
  }
  const haystack = `${relPath.toLowerCase()} ${text}`;
  return terms.some(t => haystack.includes(t));
}

async function search(projectId, projectPath, query, depth) {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(projectId);
  orch.setGraphExpansionDepth(depth);
  const results = await orch.performSemanticSearch(query, projectPath);
  return results.map(r => {
    const file = r.file || '';
    return (path.isAbsolute(file) ? path.relative(projectPath, file) : file).replace(/\\/g, '/');
  });
}

const rankOf = (files, target) => {
  const i = files.findIndex(f => f.includes(target));
  return i === -1 ? 0 : i + 1;
};
const recallAt = (ranks, k) => ranks.filter(r => r > 0 && r <= k).length / ranks.length;
const avg = xs => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
const pct = n => `${(n * 100).toFixed(1)}%`;

(async () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'corpus.json'), 'utf-8'));
  const sm = await getStorageManager();
  const all = await sm.getProjectStore().list();

  // Newest row per name: corpus-bench creates a fresh project id on each run.
  const newest = new Map();
  for (const p of all) {
    const t = new Date(p.lastIndexed || p.updatedAt || 0).getTime();
    if (!newest.has(p.name) || t > newest.get(p.name).t) newest.set(p.name, { p, t });
  }

  console.log(`\n${c.bold}${c.cyan}━━━ graph benchmark ━━━${c.reset}`);
  console.log(`${c.dim}Each answer spans several files; a target marked "silent" contains no distinctive`);
  console.log(`term of the query, so only an edge can reach it.${c.reset}\n`);

  const byDepth = { 0: [], 1: [], 2: [] };
  let silentTotal = 0;
  let silentFound = { 0: 0, 1: 0, 2: 0 };

  for (const q of QUERIES) {
    const entry = newest.get(q.corpus);
    const corpus = cfg.corpora.find(x => x.name === q.corpus);
    if (!entry || !corpus) {
      console.log(`  ${c.yellow}skip${c.reset} ${q.id} — ${q.corpus} not indexed`);
      continue;
    }

    const terms = distinctiveTerms(q.query);
    const silent = [];
    let stale = false;
    for (const target of q.mustFind) {
      const present = lexicallyPresent(corpus.path, target, terms);
      if (present === null) { stale = true; break; }
      if (!present) silent.push(target);
    }
    if (stale) {
      console.log(`  ${c.red}stale${c.reset} ${q.id} — a target no longer exists`);
      continue;
    }

    const results = {};
    for (const depth of [0, 1, 2]) {
      const files = await search(entry.p.id, corpus.path, q.query, depth);
      const ranks = q.mustFind.map(t => rankOf(files, t));
      results[depth] = { ranks, r5: recallAt(ranks, 5), r10: recallAt(ranks, 10) };
      byDepth[depth].push(results[depth]);
      for (const target of silent) {
        if (rankOf(files, target) > 0) silentFound[depth]++;
      }
    }
    silentTotal += silent.length;

    const gained = results[1].r10 > results[0].r10;
    const mark = gained ? `${c.green}graph helped${c.reset}` : `${c.dim}no change${c.reset}`;
    console.log(`  ${c.bold}${q.id.padEnd(18)}${c.reset} R@10  depth0 ${pct(results[0].r10).padStart(6)}  `
      + `depth1 ${pct(results[1].r10).padStart(6)}  depth2 ${pct(results[2].r10).padStart(6)}   ${mark}`);
    console.log(`    ${c.dim}${q.query}${c.reset}`);
    for (const target of q.mustFind) {
      const isSilent = silent.includes(target);
      const r0 = rankOf(await search(entry.p.id, corpus.path, q.query, 0), target);
      const r1 = rankOf(await search(entry.p.id, corpus.path, q.query, 1), target);
      console.log(`      ${isSilent ? c.yellow + 'silent' + c.reset : c.dim + 'named ' + c.reset}`
        + ` rank ${String(r0 || '-').padStart(2)} -> ${String(r1 || '-').padStart(2)}  ${c.dim}${target}${c.reset}`);
    }
    console.log('');
  }

  if (byDepth[1].length === 0) {
    console.log('No corpus indexed. Run scripts/corpus-bench.js --all first.\n');
    process.exit(0);
  }

  console.log(`  ${c.bold}aggregate over ${byDepth[1].length} queries${c.reset}`);
  for (const depth of [0, 1, 2]) {
    console.log(`    depth ${depth}   R@5 ${pct(avg(byDepth[depth].map(r => r.r5))).padStart(6)}`
      + `   R@10 ${pct(avg(byDepth[depth].map(r => r.r10))).padStart(6)}`
      + `   lexically-silent targets found ${silentFound[depth]}/${silentTotal}`);
  }

  const gain = avg(byDepth[1].map(r => r.r10)) - avg(byDepth[0].map(r => r.r10));
  console.log('');
  if (gain > 0.001) {
    console.log(`  ${c.green}Graph expansion retrieves files search alone does not${c.reset} — R@10 +${pct(gain)}.`);
  } else if (gain < -0.001) {
    console.log(`  ${c.red}Graph expansion displaces better results${c.reset} — R@10 ${pct(gain)}.`);
  } else {
    console.log(`  ${c.red}Graph expansion changes nothing${c.reset} on queries built specifically to need it.`);
    console.log(`  ${silentFound[0]}/${silentTotal} lexically-silent targets were already found without it.`);
  }
  console.log('');
  process.exit(0);
})().catch(e => { console.error('fatal:', e.message); process.exit(1); });
