import { describe, expect, it, vi } from "vitest";
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  MODEL_DIMENSION,
  VECTOR_METRIC,
} from "../src/config";
// @ts-expect-error -- Vite `?raw` import: the module source as a string.
import source from "../src/services/embeddings.ts?raw";
import {
  l2Normalize,
  toDocumentInput,
  toIndexVector,
  toQueryInput,
} from "../src/services/embeddings";

// Distinct non-empty prefixes, so the test does not depend on the S04b choice.
vi.mock("../src/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/config")>()),
  DOCUMENT_PREFIX: "doc: ",
  QUERY_PREFIX: "query: ",
}));

const norm = (v: number[]) => Math.hypot(...v);
const rawVector = (fill: (i: number) => number) =>
  Array.from({ length: MODEL_DIMENSION }, (_, i) => fill(i));

describe("prefixes", () => {
  it("prepends the document prefix to chunk text", () => {
    expect(toDocumentInput("No princípio")).toBe("doc: No princípio");
  });

  it("prepends the query prefix to questions", () => {
    expect(toQueryInput("Quem criou?")).toBe("query: Quem criou?");
  });
});

describe("l2Normalize", () => {
  it("scales to unit length, keeping direction and signs", () => {
    expect(l2Normalize([3, -4])).toEqual([0.6, -0.8]);
  });

  it("does not mutate its input", () => {
    const input = [3, 4];
    l2Normalize(input);
    expect(input).toEqual([3, 4]);
  });

  it.each([
    ["empty", []],
    ["zero", [0, 0]],
    ["NaN", [1, Number.NaN]],
    ["infinite", [1, Number.POSITIVE_INFINITY]],
  ])("rejects a %s vector", (_name, vector) => {
    expect(() => l2Normalize(vector)).toThrow();
  });
});

describe("AC same-model: shared parameters and behavior", () => {
  it("same-model: pins the model, dimensions and metric decided in the budget", () => {
    expect(EMBEDDING_MODEL).toBe("@cf/google/embeddinggemma-300m");
    expect(MODEL_DIMENSION).toBe(768);
    expect(EMBEDDING_DIMENSION).toBe(512);
    expect(VECTOR_METRIC).toBe("cosine");
  });

  it("same-model: returns exactly the first N values over their L2 norm", () => {
    const raw = rawVector((i) => Math.sin(i + 1) * 3);
    const snapshot = [...raw];
    const head = snapshot.slice(0, 512);
    const length = Math.sqrt(head.reduce((sum, x) => sum + x * x, 0));

    const result = toIndexVector(raw);

    expect(result).toHaveLength(512);
    result.forEach((x, i) => expect(x).toBeCloseTo(head[i]! / length, 12));
    expect(raw).toEqual(snapshot);
    // Same raw output on either side gives a bit-identical vector.
    expect(toIndexVector(snapshot)).toEqual(result);
  });

  it("same-model: adds only the prefix, leaving the text untouched", () => {
    const text = "  João 3:16\n“Porque Deus…”  ";
    expect(toDocumentInput(text)).toBe(`doc: ${text}`);
    expect(toQueryInput(text)).toBe(`query: ${text}`);
  });

  it("tests: stays pure, importing only config and never logging", () => {
    const imports = [...source.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)];
    expect(imports.map((m) => m[1])).toEqual(["../config"]);
    expect(source).not.toMatch(/\b(console|fetch|process|env)\s*[.(]/);
  });
});

describe("toIndexVector", () => {
  it("keeps the first 512 dimensions and renormalizes them", () => {
    const result = toIndexVector(rawVector((i) => i + 1));
    expect(result).toHaveLength(EMBEDDING_DIMENSION);
    expect(norm(result)).toBeCloseTo(1, 12);
    const expectedNorm = norm(
      Array.from({ length: EMBEDDING_DIMENSION }, (_, i) => i + 1),
    );
    expect(result[0]).toBeCloseTo(1 / expectedNorm, 12);
    expect(result.at(-1)).toBeCloseTo(EMBEDDING_DIMENSION / expectedNorm, 12);
  });

  it("ignores the truncated tail when normalizing", () => {
    const head = (i: number) => (i < EMBEDDING_DIMENSION ? 1 : 0);
    const noisy = (i: number) => (i < EMBEDDING_DIMENSION ? 1 : 100);
    expect(toIndexVector(rawVector(noisy))).toEqual(
      toIndexVector(rawVector(head)),
    );
  });

  it("rejects a vector whose kept dimensions are all zero", () => {
    const raw = rawVector((i) => (i < EMBEDDING_DIMENSION ? 0 : 1));
    expect(() => toIndexVector(raw)).toThrow();
  });

  it.each([EMBEDDING_DIMENSION, MODEL_DIMENSION - 1, 1024])(
    "rejects a raw embedding with %i dimensions",
    (length) => {
      expect(() => toIndexVector(new Array(length).fill(1))).toThrow(
        `got ${length}`,
      );
    },
  );
});
