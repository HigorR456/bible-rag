import { describe, expect, it } from "vitest";
import {
  DOCUMENT_PREFIX,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  MODEL_DIMENSION,
  QUERY_PREFIX,
  VECTOR_METRIC,
} from "../src/config";

const FREE_PLAN_STORED_DIMENSIONS = 5_000_000;
const MEASURED_CHUNKS = 8102; // specs/design/dimension-budget.md (2026-11-18)

describe("S04b model, dimension and prefixes", () => {
  it("budget: model, native/stored dimension and metric match the decision", () => {
    expect(EMBEDDING_MODEL).toBe("@cf/google/embeddinggemma-300m");
    expect(MODEL_DIMENSION).toBe(768);
    expect(EMBEDDING_DIMENSION).toBe(512);
    expect(EMBEDDING_DIMENSION).toBeLessThanOrEqual(MODEL_DIMENSION);
    expect(VECTOR_METRIC).toBe("cosine");
  });

  it("budget: measured chunks x stored dimension fits in 5M dimensions", () => {
    expect(MEASURED_CHUNKS * EMBEDDING_DIMENSION).toBeLessThanOrEqual(
      FREE_PLAN_STORED_DIMENSIONS,
    );
    // 768 does not fit, which is why truncation is required.
    expect(MEASURED_CHUNKS * MODEL_DIMENSION).toBeGreaterThan(
      FREE_PLAN_STORED_DIMENSIONS,
    );
  });

  it("budget: prefixes are the decided EmbeddingGemma retrieval prompts", () => {
    expect(DOCUMENT_PREFIX).toBe("title: none | text: ");
    expect(QUERY_PREFIX).toBe("task: search result | query: ");
  });

  it("budget: prefixes are non-empty and differ (query vs document)", () => {
    expect(DOCUMENT_PREFIX.length).toBeGreaterThan(0);
    expect(QUERY_PREFIX.length).toBeGreaterThan(0);
    expect(DOCUMENT_PREFIX).not.toBe(QUERY_PREFIX);
  });
});
