/**
 * Embedding identity — the stamp that says which embedder built an index.
 *
 * Vectors from two different embedders are not comparable. They have the same shape and
 * the same value range, so nothing errors: queries return results, the results are just
 * subtly wrong, and the ranking degrades in a way nobody notices until search feels
 * worse for reasons no one can name.
 *
 * This was not hypothetical. Migrating from `@xenova/transformers` to
 * `@huggingface/transformers` changed the default ONNX quantization from q8 to fp32 —
 * same model id, same 384 dimensions, max component delta 1.03e-2. Pinning q8 kept the
 * vectors identical (delta 3.17e-7) so no index had to be rebuilt, but the near miss is
 * the reason this exists: the next change may not be reconcilable, and it must fail
 * loudly rather than quietly.
 *
 * The stamp is written to the project record when an index is built and checked before
 * a search uses it. A mismatch is an error naming the fix, never a silent degradation.
 */

/** Model identifier used for all embeddings. */
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

/** ONNX weight quantization. Changing this changes the vectors. */
export const EMBEDDING_DTYPE = 'q8';

/** Vector dimensionality produced by the model above. */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * Identity of the current embedder, as stored on a project and compared at query time.
 *
 * Deliberately not a hash of the model weights: it must be cheap to compute on every
 * call and readable in an error message. Any change that alters the vectors must change
 * one of these fields.
 */
export function currentEmbeddingIdentity(): string {
  return `${EMBEDDING_MODEL}@${EMBEDDING_DTYPE}/${EMBEDDING_DIMENSIONS}`;
}

export interface EmbeddingCompatibility {
  compatible: boolean;
  /** Absent when the index predates stamping. */
  indexIdentity?: string;
  currentIdentity: string;
  /** Human-readable explanation, present only when incompatible. */
  reason?: string;
}

/**
 * Compare the stamp on an index against the running embedder.
 *
 * An unstamped index is treated as compatible. Indexes built before stamping existed
 * were built by the q8 embedder this code still uses, so rejecting them would force a
 * reindex that changes nothing — punishing users for our bookkeeping. When the stamp is
 * present it is authoritative.
 */
export function checkEmbeddingCompatibility(
  metadata: Record<string, unknown> | undefined
): EmbeddingCompatibility {
  const currentIdentity = currentEmbeddingIdentity();
  const indexIdentity = metadata?.embeddingIdentity as string | undefined;

  if (!indexIdentity) {
    return { compatible: true, currentIdentity };
  }
  if (indexIdentity === currentIdentity) {
    return { compatible: true, indexIdentity, currentIdentity };
  }
  return {
    compatible: false,
    indexIdentity,
    currentIdentity,
    reason:
      `This index was built with "${indexIdentity}" but the running embedder is ` +
      `"${currentIdentity}". Vectors from different embedders are not comparable — ` +
      `searching would return plausible-looking but wrongly ranked results.`,
  };
}

/** The metadata patch to store on a project when its index is built. */
export function embeddingStamp(): Record<string, unknown> {
  return {
    embeddingIdentity: currentEmbeddingIdentity(),
    embeddingModel: EMBEDDING_MODEL,
    embeddingDtype: EMBEDDING_DTYPE,
    embeddingDimensions: EMBEDDING_DIMENSIONS,
    embeddingStampedAt: new Date().toISOString(),
  };
}
