/**
 * Saying "this corpus probably has no answer".
 *
 * Search always returns files. Ask a Django project about Kubernetes and it returns
 * `articles/views.py` — the least irrelevant thing it has. An agent reading that will
 * answer the question from it.
 *
 * The `score` field cannot warn anyone. An FTS-only hit is normalised against the best
 * score in its own result set, so the top text match is always 0.85 however irrelevant,
 * and the additive ranking boosts push good and bad alike into the 1.0 cap. Measured on
 * the real corpora, `kubernetes deployment yaml ingress replica set` against the Express
 * RealWorld app reports a score of 100.0% while its best cosine is 28.8%.
 *
 * scripts/relevance-floor.js measured all three candidate signals over nine answerable and
 * fifteen unanswerable questions across three corpora:
 *
 *   reported score  answerable mean 88.9%   unanswerable mean 62.5%   overlap 42.3 points
 *   raw cosine      answerable mean 54.3%   unanswerable mean 17.6%   overlap  1.3 points
 *   BM25            answerable mean 226     unanswerable mean 24.6    overlap 71.1
 *
 * Only the cosine separates them, and it was already being carried on every result and
 * consumed by nothing.
 */

import { assessConfidence, LOW_CONFIDENCE_COSINE } from '../../src/mcp/mcp-server';

const withCosines = (...cosines: number[]) =>
  cosines.map(vectorScore => ({ debug: { vectorScore } }));

describe('search confidence', () => {
  it('calls a strong semantic match high confidence', () => {
    // Django, "follow and unfollow another user profile": best cosine 76.0%.
    expect(assessConfidence(withCosines(0.76, 0.51, 0.33)).level).toBe('high');
  });

  it('calls a corpus with no answer low confidence, and says why', () => {
    // Express, "kubernetes deployment yaml ingress replica set": best cosine 28.8%,
    // while the reported score for the same query is 100.0%.
    const verdict = assessConfidence(withCosines(0.288, 0.19, 0.12));
    expect(verdict.level).toBe('low');
    expect(verdict.note).toContain('29%');
    expect(verdict.note).toContain('closest available');
  });

  it('judges on the best result, not the first or the worst', () => {
    // A weak top hit followed by a strong one is still a corpus that has the answer.
    expect(assessConfidence(withCosines(0.12, 0.71)).level).toBe('high');
  });

  it('reports unknown rather than low when no result carries a cosine', () => {
    // A pure text search produces no vector score. Absent evidence is not evidence of
    // absence, and calling that "low" would warn on every FTS-only search.
    const verdict = assessConfidence([{}, { debug: {} }, { debug: { vectorScore: 0 } }]);
    expect(verdict.level).toBe('unknown');
    expect(verdict.note).toBeUndefined();
  });

  it('reports unknown for an empty result set', () => {
    expect(assessConfidence([]).level).toBe('unknown');
  });

  it('treats the threshold itself as high', () => {
    // Stated so a future tuning of the constant cannot silently flip the boundary.
    expect(assessConfidence(withCosines(LOW_CONFIDENCE_COSINE)).level).toBe('high');
    expect(assessConfidence(withCosines(LOW_CONFIDENCE_COSINE - 0.001)).level).toBe('low');
  });

  it('never suppresses results — it only labels them', () => {
    // The whole design constraint: a low-confidence answer is still returned, because the
    // measured overlap between the two distributions is 1.3 points and dropping results
    // would silently hide the answerable queries that fall inside it.
    const verdict = assessConfidence(withCosines(0.05));
    expect(verdict.level).toBe('low');
    expect(verdict).not.toHaveProperty('results');
  });
});
