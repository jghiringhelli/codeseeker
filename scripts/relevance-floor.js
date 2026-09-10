#!/usr/bin/env node
/**
 * Is there a relevance floor to find?
 *
 * CodeSeeker always returns files. Ask a Django project about Kubernetes and it returns
 * `articles/views.py` — the least irrelevant thing it has, with nothing to say it is
 * irrelevant. An agent reading that will answer the question from it.
 *
 * Before adding a threshold, check that one exists: are the top scores for a question the
 * corpus can answer actually separable from the top scores for one it cannot? If the two
 * distributions overlap, a floor would suppress real answers and must not be added.
 *
 * Usage: node scripts/relevance-floor.js
 */

process.env.CODESEEKER_STORAGE_MODE = process.env.CODESEEKER_STORAGE_MODE || 'embedded';

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { getStorageManager } = require(path.join(ROOT, 'dist/storage/storage-manager.js'));
const { SemanticSearchOrchestrator } = require(path.join(ROOT, 'dist/cli/commands/services/semantic-search-orchestrator.js'));
const { EmbeddingService } = require(path.join(ROOT, 'dist/cli/services/data/embedding/embedding-service.js'));

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };

/** Questions each corpus can answer, and questions no code corpus here can. */
const ANSWERABLE = {
  'realworld-django': [
    'generate a JWT token for a user with an expiry date',
    'follow and unfollow another user profile',
    'wrap the JSON response body in a named envelope key',
  ],
  'realworld-react-redux': [
    'send HTTP requests to the API with the auth token attached',
    'persist the JWT to local storage after login or register',
    'render the page numbers under a list of articles',
  ],
  'realworld-node-express': [
    'create update and delete an article by its slug',
    'log a user in and sign a JWT for them',
    'return the list of popular tags',
  ],
};

/** Plausible-sounding engineering questions none of these corpora contain an answer to. */
const UNANSWERABLE = [
  'kubernetes deployment yaml ingress replica set',
  'sql migration schema primary key index',
  'bluetooth pairing handshake gatt characteristic',
  'shader vertex fragment uniform matrix transform',
  'kafka consumer group offset partition rebalance',
];

const pct = (n) => `${(n * 100).toFixed(1)}%`;

(async () => {
  const sm = await getStorageManager();
  const projects = await sm.getProjectStore().list();
  const seen = new Set();

  const answerable = [];
  const unanswerable = [];
  const embedder = new EmbeddingService();
  const vectorStore = sm.getVectorStore();

  console.log(`\n${c.bold}${c.cyan}━━━ relevance floor ━━━${c.reset}\n`);

  for (const project of projects) {
    if (!ANSWERABLE[project.name] || seen.has(project.name)) continue;
    seen.add(project.name);

    const search = async (query) => {
      const orch = new SemanticSearchOrchestrator();
      orch.setProjectId(project.id);
      const results = await orch.performSemanticSearch(query, project.path);
      const reported = results.length ? results[0].similarity : 0;

      // The reported score is not a confidence. An FTS-only hit is normalised against the
      // best score in its own result set, so the top text match is always 0.85 however
      // irrelevant, and the additive boosts push good and bad alike into the 1.0 cap.
      // Measure the two underlying signals separately to see whether either one separates.
      const embedding = await embedder.generateEmbedding(query);
      const byVector = await vectorStore.searchByVector(embedding, project.id, 5);
      const byText = await vectorStore.searchByText(query, project.id, 5);
      return {
        reported,
        cosine: byVector.length ? byVector[0].score : 0,
        bm25: byText.length ? byText[0].score : 0,
      };
    };

    console.log(`  ${c.bold}${project.name}${c.reset}`);
    const show = (label, colour, m, query) => console.log(
      `    ${colour}${label}${c.reset} reported ${pct(m.reported).padStart(7)}`
      + `  cosine ${pct(m.cosine).padStart(7)}  bm25 ${m.bm25.toFixed(2).padStart(7)}`
      + `  ${c.dim}${query}${c.reset}`);

    for (const query of ANSWERABLE[project.name]) {
      const m = await search(query);
      answerable.push(m);
      show('answerable  ', c.green, m, query);
    }
    for (const query of UNANSWERABLE) {
      const m = await search(query);
      unanswerable.push(m);
      show('unanswerable', c.yellow, m, query);
    }
    console.log('');
  }

  if (!answerable.length) {
    console.log('No indexed corpus matched. Run scripts/corpus-bench.js --all first.\n');
    process.exit(0);
  }

  const min = (xs) => Math.min(...xs);
  const max = (xs) => Math.max(...xs);
  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;

  // Judge each candidate signal on its own terms.
  for (const [signal, fmt] of [['reported', pct], ['cosine', pct], ['bm25', (v) => v.toFixed(2)]]) {
    const yes = answerable.map(m => m[signal]);
    const no = unanswerable.map(m => m[signal]);
    console.log(`  ${c.bold}${signal.padEnd(9)}${c.reset} answerable   min ${fmt(min(yes)).padStart(7)}  mean ${fmt(mean(yes)).padStart(7)}  max ${fmt(max(yes)).padStart(7)}`);
    console.log(`  ${' '.repeat(9)}  unanswerable min ${fmt(min(no)).padStart(7)}  mean ${fmt(mean(no)).padStart(7)}  max ${fmt(max(no)).padStart(7)}`);

    const gap = min(yes) - max(no);
    if (gap > 0) {
      console.log(`  ${' '.repeat(9)}  ${c.green}SEPARABLE${c.reset} — a floor at ${fmt(max(no) + gap / 2)} rejects every`);
      console.log(`  ${' '.repeat(9)}  unanswerable query and keeps every answerable one, on this sample.`);
    } else {
      console.log(`  ${' '.repeat(9)}  ${c.red}NOT SEPARABLE${c.reset} — distributions overlap by ${fmt(-gap)}.`);
    }
    console.log('');
  }
  process.exit(0);
})().catch((e) => { console.error('fatal:', e.message); process.exit(1); });
