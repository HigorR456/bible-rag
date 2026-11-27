/** Central, shared parameters. Used by the Worker and by ingestion. */

export const EMBEDDING_MODEL = "@cf/google/embeddinggemma-300m";
/** Native model dimension, before truncation. */
export const MODEL_DIMENSION = 768;
/** Stored dimension (truncate to the first N, then L2-normalize). */
export const EMBEDDING_DIMENSION = 512;
export const VECTOR_METRIC = "cosine";

/**
 * EmbeddingGemma task prefixes, applied identically at ingestion and query.
 * Provisional: empty until S04b decides and records them.
 */
export const DOCUMENT_PREFIX = "";
export const QUERY_PREFIX = "";

export const TOP_K_DEFAULT = 6;
export const TOP_K_MAX = 8;

/** Provisional similarity threshold; calibrated in S10b. */
export const SIMILARITY_THRESHOLD = 0.5;

export const TRANSLATION = "ONBV";
