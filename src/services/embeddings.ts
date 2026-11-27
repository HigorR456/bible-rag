/**
 * Pure embedding pre/post-processing, shared by ingestion and query so both
 * sides produce compatible vectors. No runtime or network dependencies.
 */
import {
  DOCUMENT_PREFIX,
  EMBEDDING_DIMENSION,
  MODEL_DIMENSION,
  QUERY_PREFIX,
} from "../config";

/** Model input for a chunk (ingestion side). */
export function toDocumentInput(text: string): string {
  return DOCUMENT_PREFIX + text;
}

/** Model input for a question (query side). */
export function toQueryInput(question: string): string {
  return QUERY_PREFIX + question;
}

/** Returns a copy of the vector scaled to unit Euclidean length. */
export function l2Normalize(vector: readonly number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error("Cannot normalize a zero or non-finite vector");
  }
  return vector.map((x) => x / norm);
}

/**
 * Turns a raw model output into the stored/queried vector: the first
 * `EMBEDDING_DIMENSION` values, then L2-normalized. Rejects any other input
 * size, which would mean a different model than the one configured.
 */
export function toIndexVector(raw: readonly number[]): number[] {
  if (raw.length !== MODEL_DIMENSION) {
    throw new Error(
      `Expected a ${MODEL_DIMENSION}-dimension embedding, got ${raw.length}`,
    );
  }
  return l2Normalize(raw.slice(0, EMBEDDING_DIMENSION));
}
