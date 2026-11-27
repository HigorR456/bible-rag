import { describe, expect, it } from "vitest";
import { BOOKS, BOOK_CODES, isBookCode } from "../src/books";
import {
  EMBEDDING_DIMENSION,
  MODEL_DIMENSION,
  TOP_K_DEFAULT,
  TOP_K_MAX,
} from "../src/config";

describe("books", () => {
  it("has 66 books with consecutive canonical order", () => {
    expect(BOOK_CODES).toHaveLength(66);
    const orders = Object.values(BOOKS).map((b) => b.order);
    expect(orders).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
  });

  it("splits 39 AT and 27 NT, switching at Matthew", () => {
    const all = Object.values(BOOKS);
    expect(all.filter((b) => b.testament === "AT")).toHaveLength(39);
    expect(all.filter((b) => b.testament === "NT")).toHaveLength(27);
    expect(BOOKS.MAL.testament).toBe("AT");
    expect(BOOKS.MAT.testament).toBe("NT");
  });

  it("uses Portuguese names and the data's codes", () => {
    expect(BOOKS.JOH.name).toBe("João");
    expect(BOOKS.GEN.name).toBe("Gênesis");
    expect(BOOKS.JOB.name).toBe("Jó");
    expect(isBookCode("JOH")).toBe(true);
    expect(isBookCode("JHN")).toBe(false);
    expect(isBookCode("toString")).toBe(false);
  });

  it("keeps each key equal to its code and names unique", () => {
    for (const [key, b] of Object.entries(BOOKS)) expect(b.code).toBe(key);
    expect(new Set(Object.values(BOOKS).map((b) => b.name)).size).toBe(66);
  });
});

describe("config", () => {
  it("keeps the dimension within the model and top_k bounds sane", () => {
    expect(EMBEDDING_DIMENSION).toBeLessThanOrEqual(MODEL_DIMENSION);
    expect(TOP_K_DEFAULT).toBeLessThanOrEqual(TOP_K_MAX);
  });

  it("fits the 5M stored-dimension budget with 8,102 chunks", () => {
    expect(8102 * EMBEDDING_DIMENSION).toBeLessThanOrEqual(5_000_000);
  });
});

// Added by tester: derived from the Spec and the real data file (S03c, fr-search).
import { readFileSync } from "node:fs";
import { SIMILARITY_THRESHOLD, EMBEDDING_MODEL, VECTOR_METRIC, DOCUMENT_PREFIX, QUERY_PREFIX } from "../src/config";

describe("books vs. ingestion/chunks_onbv.jsonl (fr-search)", () => {
  const rows = readFileSync("ingestion/chunks_onbv.jsonl", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { book: string });
  const dataCodes = [...new Set(rows.map((r) => r.book))];

  it("AC fr-search: BOOK_CODES equals the codes in the data, in canonical order", () => {
    expect(dataCodes).toEqual([...BOOK_CODES]);
  });

  it("AC fr-search: every chunk's book is a valid BookCode", () => {
    expect(rows.every((r) => isBookCode(r.book))).toBe(true);
  });

  it("AC fr-search: codes are 3 chars, uppercase alphanumeric", () => {
    for (const c of BOOK_CODES) expect(c).toMatch(/^[0-9A-Z]{3}$/);
  });

  it("AC fr-search: canonical Portuguese names (spot checks)", () => {
    const n = (c: string) => BOOKS[c as keyof typeof BOOKS].name;
    expect(n("PSA")).toBe("Salmos");
    expect(n("SOL")).toBe("Cantares de Salomão");
    expect(n("REV")).toBe("Apocalipse");
    expect(n("1JO")).toBe("1 João");
    expect(n("ACT")).toBe("Atos");
    expect(n("JAM")).toBe("Tiago");
    expect(n("JUD")).toBe("Judas");
    expect(n("MAR")).toBe("Marcos");
  });

  it("AC fr-search: isBookCode rejects invalid/lowercase/prototype keys", () => {
    for (const v of ["", "joh", "JHN", "__proto__", "constructor", "GEN ", "HOSEA"]) {
      expect(isBookCode(v)).toBe(false);
    }
  });
});

describe("config vs. spec", () => {
  it("matches the decided parameters", () => {
    expect(EMBEDDING_MODEL).toBe("@cf/google/embeddinggemma-300m");
    expect(MODEL_DIMENSION).toBe(768);
    expect(EMBEDDING_DIMENSION).toBe(512);
    expect(VECTOR_METRIC).toBe("cosine");
    expect(TOP_K_DEFAULT).toBe(6);
    expect(TOP_K_MAX).toBe(8);
  });

  it("threshold is a valid cosine score in (0,1] and prefixes are strings", () => {
    expect(SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
    expect(typeof DOCUMENT_PREFIX).toBe("string");
    expect(typeof QUERY_PREFIX).toBe("string");
  });
});
