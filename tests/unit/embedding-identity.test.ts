/**
 * Embedding identity — compatibility gate for existing indexes.
 *
 * The failure this guards against is silent: vectors from a different embedder have the
 * same shape and range, so a search against them returns plausible results in the wrong
 * order. These tests pin the decisions that make the failure loud instead.
 */

import {
  currentEmbeddingIdentity,
  checkEmbeddingCompatibility,
  embeddingStamp,
  EMBEDDING_MODEL,
  EMBEDDING_DTYPE,
  EMBEDDING_DIMENSIONS,
} from '../../src/mcp/embedding-identity';

describe('embedding identity', () => {
  it('names the model, the quantization and the dimensions', () => {
    // All three change the vectors, so all three must be in the identity. A stamp that
    // omitted dtype would have called the q8 and fp32 embedders identical — the exact
    // near miss that motivated this module.
    const id = currentEmbeddingIdentity();
    expect(id).toContain(EMBEDDING_MODEL);
    expect(id).toContain(EMBEDDING_DTYPE);
    expect(id).toContain(String(EMBEDDING_DIMENSIONS));
  });

  it('is pinned to the quantization that matches indexes built before the migration', () => {
    // @xenova/transformers defaulted to q8. @huggingface/transformers defaults to fp32,
    // which produced a max component delta of 1.03e-2 on the same model — enough to
    // shift ranking. Changing this constant is a breaking change for every user.
    expect(EMBEDDING_DTYPE).toBe('q8');
    expect(EMBEDDING_DIMENSIONS).toBe(384);
  });
});

describe('checkEmbeddingCompatibility', () => {
  it('accepts an index stamped with the current identity', () => {
    const result = checkEmbeddingCompatibility(embeddingStamp());
    expect(result.compatible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('accepts an unstamped index', () => {
    // Indexes built before stamping existed were built by this same embedder. Rejecting
    // them would force a rebuild that changes nothing.
    expect(checkEmbeddingCompatibility(undefined).compatible).toBe(true);
    expect(checkEmbeddingCompatibility({}).compatible).toBe(true);
    expect(checkEmbeddingCompatibility({ indexedAt: 'whenever' }).compatible).toBe(true);
  });

  it('rejects an index built with a different quantization', () => {
    const result = checkEmbeddingCompatibility({
      embeddingIdentity: `${EMBEDDING_MODEL}@fp32/${EMBEDDING_DIMENSIONS}`,
    });
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('fp32');
    expect(result.reason).toContain(EMBEDDING_DTYPE);
  });

  it('rejects an index built with a different model', () => {
    const result = checkEmbeddingCompatibility({
      embeddingIdentity: `Xenova/bge-small-en@${EMBEDDING_DTYPE}/${EMBEDDING_DIMENSIONS}`,
    });
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('bge-small-en');
  });

  it('rejects an index of a different dimensionality', () => {
    const result = checkEmbeddingCompatibility({
      embeddingIdentity: `${EMBEDDING_MODEL}@${EMBEDDING_DTYPE}/768`,
    });
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('768');
  });

  it('explains the consequence, not just the mismatch', () => {
    // The caller is an AI assistant deciding what to tell a user. "Identity mismatch"
    // is not actionable; "results would be wrongly ranked" is.
    const result = checkEmbeddingCompatibility({ embeddingIdentity: 'other@fp32/384' });
    expect(result.reason).toMatch(/not comparable|wrongly ranked/i);
  });

  it('reports both identities so the difference is visible', () => {
    const result = checkEmbeddingCompatibility({ embeddingIdentity: 'other@fp32/384' });
    expect(result.indexIdentity).toBe('other@fp32/384');
    expect(result.currentIdentity).toBe(currentEmbeddingIdentity());
  });
});

describe('embeddingStamp', () => {
  it('records the fields separately as well as the composite identity', () => {
    const stamp = embeddingStamp();
    expect(stamp.embeddingIdentity).toBe(currentEmbeddingIdentity());
    expect(stamp.embeddingModel).toBe(EMBEDDING_MODEL);
    expect(stamp.embeddingDtype).toBe(EMBEDDING_DTYPE);
    expect(stamp.embeddingDimensions).toBe(EMBEDDING_DIMENSIONS);
    // A timestamp makes it possible to tell how old an index is when diagnosing.
    expect(typeof stamp.embeddingStampedAt).toBe('string');
    expect(new Date(stamp.embeddingStampedAt as string).getTime()).not.toBeNaN();
  });

  it('round-trips through the compatibility check', () => {
    expect(checkEmbeddingCompatibility(embeddingStamp()).compatible).toBe(true);
  });
});
