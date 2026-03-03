/**
 * Quick smoke test for RaptorIndexingService pure functions.
 * Run: node scripts/test-raptor.mjs
 */
import { RaptorIndexingService, RAPTOR_FILE_PREFIX } from '../dist/cli/services/search/raptor-indexing-service.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); passed++; }
  else       { console.error('  ✗ FAIL:', msg); failed++; }
}

const svc = new RaptorIndexingService();

// ── ID helpers ──────────────────────────────────────────────────────────────
assert(svc.makeL2Id('p1', 'src/cli') === 'raptor-l2:p1:src-cli',           'L2 ID stable');
assert(svc.makeL2Id('p1', 'src/cli/services') === 'raptor-l2:p1:src-cli-services', 'L2 ID nested path');
assert(svc.makeL3Id('p1') === 'raptor-l3:p1:root',                          'L3 ID stable');
assert(svc.makeL2Id('p1', '.') === 'raptor-l2:p1:root',                    'L2 ID root dir');

// ── isRaptorPath / realPath ─────────────────────────────────────────────────
assert(RaptorIndexingService.isRaptorPath('__raptor__/src/cli'),    'isRaptorPath positive');
assert(!RaptorIndexingService.isRaptorPath('src/cli/service.ts'),   'isRaptorPath negative');
assert(RaptorIndexingService.realPath('__raptor__/src/cli') === 'src/cli', 'realPath strips prefix');
assert(RaptorIndexingService.realPath('src/cli.ts') === 'src/cli.ts',      'realPath passthrough');
assert(RAPTOR_FILE_PREFIX === '__raptor__/',                                 'prefix constant');

// ── meanPool ─────────────────────────────────────────────────────────────────
const m1 = svc.meanPool([[1,0],[0,1],[1,1]]);
assert(Math.abs(m1[0] - 2/3) < 1e-9, 'meanPool x=2/3');
assert(Math.abs(m1[1] - 2/3) < 1e-9, 'meanPool y=2/3');

const m2 = svc.meanPool([[3,0]]);
assert(m2[0] === 3 && m2[1] === 0,   'meanPool single vector identity');

assert(svc.meanPool([]).length === 0, 'meanPool empty → []');

// ── cosineSimilarity ─────────────────────────────────────────────────────────
assert(Math.abs(svc.cosineSimilarity([1,0],[1,0]) - 1) < 1e-9, 'cosine self = 1');
assert(Math.abs(svc.cosineSimilarity([1,0],[0,1]))     < 1e-9, 'cosine orthogonal = 0');
assert(Math.abs(svc.cosineSimilarity([1,0],[-1,0]) + 1) < 1e-9, 'cosine opposite = -1');
assert(svc.cosineSimilarity([], []) === 0,                       'cosine empty = 0');

// ── Drift threshold: identical vector → skip ──────────────────────────────────
const drift0 = 1 - svc.cosineSimilarity([0.3, 0.7], [0.3, 0.7]);
assert(drift0 < 0.05, 'drift on identical vec < SKIP_THRESHOLD');

// Completely different → do NOT skip
const drift1 = 1 - svc.cosineSimilarity([1,0,0,0], [0,1,0,0]);
assert(drift1 > 0.05, 'drift on orthogonal vec > SKIP_THRESHOLD');

// ── computeStructuralHash ─────────────────────────────────────────────────────
const h1 = svc.computeStructuralHash(['b.ts','a.ts','c.ts']);
const h2 = svc.computeStructuralHash(['a.ts','c.ts','b.ts']);
const h3 = svc.computeStructuralHash(['a.ts','c.ts']);
assert(h1 === h2, 'structural hash is order-independent');
assert(h1 !== h3, 'structural hash changes on file removal');
assert(h1.length === 16, 'structural hash is 16-char hex');

// ── groupByDirectory ─────────────────────────────────────────────────────────
const g = svc.groupByDirectory(['src/a/x.ts','src/a/y.ts','src/b/z.ts', 'root.ts']);
assert(g.get('src/a').length === 2, 'groupByDir src/a count');
assert(g.get('src/b').length === 1, 'groupByDir src/b count');
assert(g.get('.').length === 1,     'groupByDir root file goes to "."');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
