#!/usr/bin/env node
/**
 * Fingerprint the embedding model's output.
 *
 * An embedding migration is only safe if the vectors it produces are the ones already
 * in every user's index. Vectors that shift silently do not fail — they degrade
 * ranking, which nobody notices until search quality is quietly worse.
 *
 * This captures a deterministic fingerprint over fixed inputs so before/after can be
 * compared numerically rather than assumed.
 *
 * Usage:
 *   node scripts/embedding-fingerprint.js                       # print + save baseline
 *   node scripts/embedding-fingerprint.js --compare <file.json> # compare against one
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// Fixed probes chosen to exercise different regions of the embedding space: code,
// prose, a symbol name, an empty-ish string, and unicode.
const PROBES = [
  'export class AuthService { async authenticate(user: string) { return jwt.sign(user); } }',
  'how does the project handle authentication and token refresh',
  'RaptorIndexingService',
  'def calculate_total(items): return sum(i.price for i in items)',
  'a',
  'función de validación con acentos y ñ',
];

const round = (x) => Math.round(x * 1e6) / 1e6;

async function fingerprint() {
  const { EmbeddingGeneratorAdapter } = require(path.join(ROOT, 'dist/cli/services/search/embedding-generator-adapter.js'));
  const gen = new EmbeddingGeneratorAdapter();

  const vectors = [];
  for (const p of PROBES) {
    const v = await gen.generateQueryEmbedding(p);
    vectors.push({ probe: p.slice(0, 50), dim: v.length, head: v.slice(0, 8).map(round), norm: round(Math.hypot(...v)) });
  }

  // Pairwise cosine similarity is what ranking actually depends on — more meaningful
  // than raw component equality, and stable across harmless numerical differences.
  const raw = [];
  for (const p of PROBES) raw.push(await gen.generateQueryEmbedding(p));
  const cos = (a, b) => {
    const d = a.reduce((s, x, i) => s + x * b[i], 0);
    return round(d / (Math.hypot(...a) * Math.hypot(...b)));
  };
  const sims = [];
  for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) sims.push({ i, j, cos: cos(raw[i], raw[j]) });

  const digest = crypto.createHash('sha256')
    .update(JSON.stringify(vectors.map(v => v.head)) + JSON.stringify(sims))
    .digest('hex').slice(0, 16);

  return { generatedAt: new Date().toISOString(), dim: vectors[0].dim, digest, vectors, sims };
}

function compare(a, b) {
  console.log('\n═══ comparison ═══');
  console.log(`  dimension:  ${a.dim} -> ${b.dim}  ${a.dim === b.dim ? 'same' : 'CHANGED'}`);
  console.log(`  digest:     ${a.digest} -> ${b.digest}  ${a.digest === b.digest ? 'identical' : 'DIFFERENT'}`);

  let maxComp = 0;
  for (let i = 0; i < a.vectors.length; i++) {
    for (let k = 0; k < a.vectors[i].head.length; k++) {
      maxComp = Math.max(maxComp, Math.abs(a.vectors[i].head[k] - (b.vectors[i]?.head[k] ?? 0)));
    }
  }
  let maxSim = 0;
  for (let i = 0; i < a.sims.length; i++) {
    maxSim = Math.max(maxSim, Math.abs(a.sims[i].cos - (b.sims[i]?.cos ?? 0)));
  }
  console.log(`  max component delta:          ${maxComp.toExponential(2)}`);
  console.log(`  max pairwise-cosine delta:    ${maxSim.toExponential(2)}`);

  // Ranking depends on relative geometry, so the cosine delta is the number that decides
  // whether existing indexes stay valid.
  const VERDICT = maxSim < 1e-4
    ? 'COMPATIBLE — existing indexes remain valid, no reindex required'
    : maxSim < 1e-2
      ? 'DRIFT — small but measurable; ranking may shift, reindex recommended'
      : 'INCOMPATIBLE — existing indexes must be rebuilt';
  console.log(`\n  verdict: ${VERDICT}\n`);
  return maxSim < 1e-4;
}

(async () => {
  const args = process.argv.slice(2);
  const fp = await fingerprint();

  console.log(`dimension: ${fp.dim}   digest: ${fp.digest}`);
  for (const v of fp.vectors) console.log(`  "${v.probe}" norm=${v.norm} head=[${v.head.slice(0, 4).join(', ')}…]`);

  const outDir = path.join(ROOT, 'reports', 'embedding');
  fs.mkdirSync(outDir, { recursive: true });

  const ci = args.indexOf('--compare');
  if (ci >= 0 && args[ci + 1]) {
    const before = JSON.parse(fs.readFileSync(args[ci + 1], 'utf8'));
    const ok = compare(before, fp);
    fs.writeFileSync(path.join(outDir, 'after.json'), JSON.stringify(fp, null, 2));
    process.exit(ok ? 0 : 1);
  }

  const out = path.join(outDir, 'baseline.json');
  fs.writeFileSync(out, JSON.stringify(fp, null, 2));
  console.log(`\nbaseline written: ${path.relative(ROOT, out)}`);
  process.exit(0);
})().catch(e => { console.error('fatal:', e.message); process.exit(1); });
