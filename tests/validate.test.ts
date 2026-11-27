import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  EXPECTED_CHUNK_COUNT,
  parseChunks,
  parseSource,
  validateChunks,
  type Chunk,
  type SourceVerse,
} from "../ingestion/validate";
import { BOOK_CODES } from "../src/books";

function chunk(book: string, from: number, to: number, text: string, chapter = 1): Chunk {
  const range = from === to ? `${from}` : `${from}-${to}`;
  return {
    id: `${book}_${chapter}_${range}`,
    ref: `${book} ${chapter}:${range}`,
    book,
    chapter,
    verse_start: from,
    verse_end: to,
    word_count: text.split(/\s+/).filter(Boolean).length,
    text,
  };
}

/** One single-verse chunk per book, matching `source()`. */
const bible = () => BOOK_CODES.map((b) => chunk(b, 1, 1, `texto ${b}`));
const source = (): SourceVerse[] =>
  BOOK_CODES.map((book) => ({ book, chapter: 1, verse: 1, text: `texto ${book}` }));

const errorsOf = (chunks: Chunk[], verses = source()) =>
  validateChunks(chunks, { expectedCount: chunks.length, source: verses }).errors;

describe("validateChunks", () => {
  it("accepts complete coverage", () => {
    const report = validateChunks(bible(), { expectedCount: 66, source: source() });
    expect(report).toMatchObject({ errors: [], missingVerses: [], sourceChecked: true });
  });

  it("rejects a wrong chunk count", () => {
    expect(validateChunks(bible()).errors).toEqual([
      `chunk count is 66, expected ${EXPECTED_CHUNK_COUNT}`,
    ]);
  });

  it("rejects missing, unknown and out-of-order books", () => {
    expect(errorsOf(bible().slice(1), source().slice(1))).toEqual(["missing book: GEN"]);
    expect(errorsOf([...bible(), chunk("XXX", 1, 1, "a")])).toContain("unknown book: XXX");
    const [gen, exo, ...rest] = bible();
    expect(errorsOf([exo!, gen!, ...rest])).toEqual(["books are not in canonical order"]);
  });

  it("rejects a book split into two blocks", () => {
    const extra = chunk("GEN", 1, 1, "outro", 2);
    const verses = [...source(), { book: "GEN", chapter: 2, verse: 1, text: "outro" }];
    expect(errorsOf([...bible(), extra], verses)).toEqual(["books are not in canonical order"]);
  });

  it("rejects duplicate ids, empty text and wrong word_count", () => {
    const [gen, ...rest] = bible();
    expect(errorsOf([gen!, gen!, ...rest])).toContain("duplicate id: GEN_1_1");
    expect(errorsOf([{ ...gen!, text: "  ", word_count: 0 }, ...rest])).toContain(
      "GEN_1_1: empty text",
    );
    expect(errorsOf([{ ...gen!, word_count: 9 }, ...rest])).toEqual([
      "GEN_1_1: word_count is 9, text has 2",
    ]);
  });

  it("rejects overlapping ranges even without the source", () => {
    const [, ...rest] = bible();
    const chunks = [chunk("GEN", 1, 5, "a"), chunk("GEN", 2, 2, "b"), chunk("GEN", 4, 6, "c"), ...rest];
    const { errors } = validateChunks(chunks, { expectedCount: chunks.length });
    expect(errors).toEqual([
      "overlap: GEN_1_1-5 and GEN_1_2",
      "overlap: GEN_1_1-5 and GEN_1_4-6",
    ]);
  });

  it("rejects a source verse that no chunk contains", () => {
    const verses = [...source(), { book: "GEN", chapter: 1, verse: 2, text: "perdido" }];
    expect(errorsOf(bible(), verses)).toEqual(["source verse GEN 1:2 is in 0 chunks"]);
  });

  it("rejects a source verse that two chunks contain", () => {
    expect(errorsOf([...bible(), chunk("REV", 1, 1, "texto REV")])).toContain(
      "source verse REV 1:1 is in 2 chunks",
    );
  });

  it("rejects a verse dropped from inside a chunk range", () => {
    const [, ...rest] = bible();
    const verses = [
      ...source(),
      { book: "GEN", chapter: 1, verse: 2, text: "dois" },
      { book: "GEN", chapter: 1, verse: 3, text: "três" },
    ];
    expect(errorsOf([chunk("GEN", 1, 3, "texto GEN três"), ...rest], verses)).toEqual([
      "GEN_1_1-3: text differs from the source verses",
    ]);
  });

  it("lists verses missing in the source without failing", () => {
    const [, ...rest] = bible();
    const verses = [...source(), { book: "GEN", chapter: 1, verse: 3, text: "três" }];
    const chunks = [chunk("GEN", 1, 3, "texto GEN três"), ...rest];
    const report = validateChunks(chunks, { expectedCount: 66, source: verses });
    expect(report.errors).toEqual([]);
    expect(report.missingVerses).toEqual(["GEN 1:2"]);
  });

  it("lists numbering gaps between chunks when there is no source", () => {
    const [, ...rest] = bible();
    const chunks = [chunk("GEN", 2, 2, "a"), chunk("GEN", 5, 6, "b"), ...rest];
    const report = validateChunks(chunks, { expectedCount: chunks.length });
    expect(report.errors).toEqual([]);
    expect(report.missingVerses).toEqual(["GEN 1:1", "GEN 1:3", "GEN 1:4"]);
    expect(report.sourceChecked).toBe(false);
  });
});

describe("parsing", () => {
  it("reports invalid chunk lines", () => {
    const good = JSON.stringify(chunk("GEN", 1, 1, "a"));
    const parsed = parseChunks(`${good}\n{broken\n{"id":"x"}\n\n`);
    expect(parsed.chunks).toHaveLength(1);
    expect(parsed.errors).toEqual(["line 2: not a valid chunk", "line 3: not a valid chunk"]);
  });

  it("reads VPL verses, skips empty ones and reports unknown lines", () => {
    const parsed = parseSource("\uFEFFGEN 1:1  No princípio \r\nGEN 1:2\r\nGEN 1:3-4 junto\r\n");
    expect(parsed.verses).toEqual([
      { book: "GEN", chapter: 1, verse: 1, text: "No princípio" },
    ]);
    expect(parsed.emptyRefs).toEqual(["GEN 1:2"]);
    expect(parsed.errors).toEqual(["source line 3: unrecognized format"]);
  });
});

describe("chunk-integrity: source coverage edge cases", () => {
  it("chunk-integrity: rejects a dropped last verse and a dropped whole chapter", () => {
    const verses = [
      ...source(),
      { book: "REV", chapter: 1, verse: 2, text: "fim" },
      { book: "REV", chapter: 2, verse: 1, text: "outro" },
    ];
    expect(errorsOf(bible(), verses)).toEqual([
      "source verse REV 1:2 is in 0 chunks",
      "source verse REV 2:1 is in 0 chunks",
    ]);
  });

  it("chunk-integrity: rejects a chunk with no counterpart in the source", () => {
    expect(errorsOf([...bible(), chunk("REV", 1, 1, "inventado", 2)])).toEqual([
      "REV_2_1: text differs from the source verses",
    ]);
  });

  it("chunk-integrity: rejects altered wording even if word_count matches", () => {
    const [, ...rest] = bible();
    expect(errorsOf([chunk("GEN", 1, 1, "outro GEN"), ...rest])).toEqual([
      "GEN_1_1: text differs from the source verses",
    ]);
  });

  it("chunk-integrity: rejects a verse repeated in the source", () => {
    expect(errorsOf(bible(), [...source(), source()[0]!])).toContain(
      "source verse repeated: GEN 1:1",
    );
  });

  it("chunk-integrity: fails on an empty source and on an empty JSONL", () => {
    expect(errorsOf(bible(), [])).toHaveLength(66);
    expect(validateChunks([]).errors).toHaveLength(67); // 66 books + count
  });

  it("chunk-integrity: rejects out-of-range chunk fields", () => {
    const good = chunk("GEN", 1, 1, "a");
    const lines = [
      { ...good, chapter: 0 },
      { ...good, verse_start: 1.5 },
      { ...good, word_count: "1" },
    ].map((c) => JSON.stringify(c));
    expect(parseChunks(lines.join("\r\n")).errors).toHaveLength(3);
    expect(errorsOf([{ ...good, verse_start: 2 }])).toContain("GEN_1_1: verse_end before verse_start");
  });

  it("does not echo verse text in parse errors", () => {
    const errors = [
      ...parseSource("linha secreta sem referência").errors,
      ...parseChunks('{"text":"segredo"').errors,
    ];
    expect(errors).toHaveLength(2);
    expect(errors.join()).not.toMatch(/secret|segredo/);
  });
});

describe("chunk-integrity: range endpoints, textless verses and ordering", () => {
  const verse = (verse: number, text: string): SourceVerse => ({
    book: "GEN",
    chapter: 1,
    verse,
    text,
  });
  /** The bible with GEN replaced by one chunk, checked against these GEN verses. */
  const genErrors = (gen: Chunk, verses: SourceVerse[]) =>
    errorsOf([gen, ...bible().slice(1)], [...verses, ...source().slice(1)]);
  /** JSONL-only report with GEN replaced by the given chunks. */
  const jsonlOnly = (...gen: Chunk[]) => {
    const chunks = [...gen, ...bible().slice(1)];
    return validateChunks(chunks, { expectedCount: chunks.length });
  };

  it("chunk-integrity: rejects verse_end beyond the last source verse", () => {
    expect(genErrors(chunk("GEN", 1, 3, "um"), [verse(1, "um")])).toEqual([
      "GEN_1_1-3: range is 1-3, source verses are 1-1",
    ]);
  });

  it("chunk-integrity: rejects verse_start below the first source verse", () => {
    const verses = [verse(2, "dois"), verse(3, "três")];
    expect(genErrors(chunk("GEN", 1, 3, "dois três"), verses)).toEqual([
      "GEN_1_1-3: range is 1-3, source verses are 2-3",
    ]);
  });

  it("chunk-integrity: rejects chunks sharing a boundary verse, without source", () => {
    const first = chunk("GEN", 1, 3, "a");
    const second = chunk("GEN", 3, 5, "b");
    const expected = ["overlap: GEN_1_1-3 and GEN_1_3-5"];
    expect(jsonlOnly(first, second).errors).toEqual(expected);
    expect(jsonlOnly(second, first).errors).toEqual(expected);
  });

  it("chunk-integrity: unsorted adjacent chunks are neither overlaps nor gaps", () => {
    const report = jsonlOnly(chunk("GEN", 4, 5, "b"), chunk("GEN", 1, 3, "a"));
    expect(report.errors).toEqual([]);
    expect(report.missingVerses).toEqual([]);
  });

  it("chunk-integrity: finds numbering gaps in unsorted chunks", () => {
    const report = jsonlOnly(chunk("GEN", 5, 6, "b"), chunk("GEN", 2, 2, "a"));
    expect(report.errors).toEqual([]);
    expect(report.missingVerses).toEqual(["GEN 1:1", "GEN 1:3", "GEN 1:4"]);
  });

  it("chunk-integrity: finds numbering gaps in an unsorted source", () => {
    const report = validateChunks([chunk("GEN", 2, 5, "dois cinco"), ...bible().slice(1)], {
      expectedCount: 66,
      source: [verse(5, "cinco"), verse(2, "dois"), ...source().slice(1)],
    });
    expect(report.missingVerses).toEqual(["GEN 1:1", "GEN 1:3", "GEN 1:4"]);
  });

  it("chunk-integrity: lists interior, trailing and whole-chapter textless verses once", () => {
    const parsed = parseSource("GEN 1:1 um\nGEN 1:2\nGEN 1:3 três\nGEN 1:4\nGEN 2:1\nGEN 2:2   \n");
    const report = validateChunks([chunk("GEN", 1, 3, "um três"), ...bible().slice(1)], {
      expectedCount: 66,
      source: [...parsed.verses, ...source().slice(1)],
      emptyRefs: parsed.emptyRefs,
    });
    expect(parsed.errors).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.missingVerses).toEqual(["GEN 1:2", "GEN 1:4", "GEN 2:1", "GEN 2:2"]);
  });
});

describe("chunk-integrity: id, ref and chunking limits", () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`).join(" ");
  const verses = (n: number, from = 1): SourceVerse[] =>
    Array.from({ length: n }, (_, i) => ({
      book: "GEN",
      chapter: 1,
      verse: from + i,
      text: `v${from + i}`,
    }));
  const joined = (list: SourceVerse[]) => list.map((v) => v.text).join(" ");
  /** Errors with GEN replaced by one chunk, without the source. */
  const noSource = (gen: Chunk) =>
    validateChunks([gen, ...bible().slice(1)], { expectedCount: 66 }).errors;
  /** Same, checked against these GEN verses. */
  const withSource = (gen: Chunk, list: SourceVerse[]) =>
    errorsOf([gen, ...bible().slice(1)], [...list, ...source().slice(1)]);

  const ID = "id does not match book, chapter and verses";
  const REF = "ref does not match book, chapter and verses";

  it.each([
    ["book", "EXO_1_1-3"],
    ["chapter", "GEN_2_1-3"],
    ["first verse", "GEN_1_2-3"],
    ["last verse", "GEN_1_1-4"],
    ["missing range end", "GEN_1_1"],
    ["separator", "GEN 1:1-3"],
    ["trailing text", "GEN_1_1-3x"],
  ])("chunk-integrity: rejects an id with a wrong %s", (_, id) => {
    expect(noSource({ ...chunk("GEN", 1, 3, "a"), id })).toEqual([`${id}: ${ID}`]);
  });

  it.each([
    ["book", "EXO 1:1-3"],
    ["chapter", "GEN 2:1-3"],
    ["first verse", "GEN 1:2-3"],
    ["last verse", "GEN 1:1-4"],
    ["missing range end", "GEN 1:1"],
    ["separator", "GEN_1_1-3"],
  ])("chunk-integrity: rejects a ref with a wrong %s", (_, ref) => {
    expect(noSource({ ...chunk("GEN", 1, 3, "a"), ref })).toEqual([`GEN_1_1-3: ${REF}`]);
  });

  it("chunk-integrity: a single-verse chunk must not use the START-END form", () => {
    const bad = { ...chunk("GEN", 1, 1, "a"), id: "GEN_1_1-1", ref: "GEN 1:1-1" };
    expect(noSource(bad)).toEqual([`GEN_1_1-1: ${ID}`, `GEN_1_1-1: ${REF}`]);
  });

  it("chunk-integrity: checks id and ref when the source is verified too", () => {
    const bad = { ...chunk("GEN", 1, 1, "v1"), ref: "GEN 1:2" };
    expect(withSource(bad, verses(1))).toEqual([`GEN_1_1: ${REF}`]);
  });

  it("chunk-integrity: accepts 120 words in a multi-verse chunk and rejects 121", () => {
    expect(noSource(chunk("GEN", 1, 2, words(120)))).toEqual([]);
    expect(noSource(chunk("GEN", 1, 2, words(121)))).toEqual([
      "GEN_1_1-2: 121 words, max is 120",
    ]);
    const all = words(121).split(" ");
    const list = verses(2);
    list[0]!.text = all.slice(0, 60).join(" ");
    list[1]!.text = all.slice(60).join(" ");
    expect(withSource(chunk("GEN", 1, 2, joined(list)), list)).toEqual([
      "GEN_1_1-2: 121 words, max is 120",
    ]);
  });

  it.each([120, 121, 500])("chunk-integrity: a single verse may have %i words", (n) => {
    const gen = chunk("GEN", 1, 1, words(n));
    expect(noSource(gen)).toEqual([]);
    expect(withSource(gen, [{ ...verses(1)[0]!, text: words(n) }])).toEqual([]);
  });

  it("chunk-integrity: the word limit counts the text, not the declared word_count", () => {
    expect(noSource({ ...chunk("GEN", 1, 2, words(121)), word_count: 100 })).toEqual([
      "GEN_1_1-2: word_count is 100, text has 121",
      "GEN_1_1-2: 121 words, max is 120",
    ]);
  });

  it("chunk-integrity: accepts 5 source verses and rejects 6", () => {
    expect(withSource(chunk("GEN", 1, 5, joined(verses(5))), verses(5))).toEqual([]);
    expect(withSource(chunk("GEN", 1, 6, joined(verses(6))), verses(6))).toEqual([
      "GEN_1_1-6: 6 verses, max is 5",
    ]);
  });

  it("chunk-integrity: the verse limit counts source verses, not range numbers", () => {
    const five = [...verses(2), ...verses(3, 5)];
    expect(withSource(chunk("GEN", 1, 7, joined(five)), five)).toEqual([]);
    const six = [...verses(2), ...verses(4, 5)];
    expect(withSource(chunk("GEN", 1, 8, joined(six)), six)).toEqual([
      "GEN_1_1-8: 6 verses, max is 5",
    ]);
  });

  // specs/flows/ingestion.md: --jsonl-only does not verify the 5-verse limit.
  it("chunk-integrity: the verse limit is not checked without the source", () => {
    const report = validateChunks([chunk("GEN", 1, 9, "a"), ...bible().slice(1)], {
      expectedCount: 66,
    });
    expect(report).toMatchObject({ errors: [], sourceChecked: false });
  });

  it("chunk-integrity: strips only a leading BOM from the source", () => {
    const parsed = parseSource("\uFEFFGEN 1:1 um\r\nGEN 1:2 dois\r\n");
    expect(parsed.errors).toEqual([]);
    expect(parsed.verses.map((v) => [v.book, v.verse, v.text])).toEqual([
      ["GEN", 1, "um"],
      ["GEN", 2, "dois"],
    ]);
    expect(parseSource("\uFEFFGEN 1:1\n").emptyRefs).toEqual(["GEN 1:1"]);
    expect(parseSource("\uFEFF").errors).toEqual([]);
  });

  it("chunk-integrity: validate.ts and this file contain no invisible literal BOM", () => {
    for (const path of ["../ingestion/validate.ts", "./validate.test.ts"]) {
      const content = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(content.includes("\uFEFF"), path).toBe(false);
    }
  });
});

const jsonl = () =>
  parseChunks(readFileSync(new URL("../ingestion/chunks_onbv.jsonl", import.meta.url), "utf8"))
    .chunks;
/**
 * Stand-in VPL matching the real JSONL: the words of each chunk are spread over
 * every verse number of its range (one each, the remainder on verse_end).
 */
const vpl = () =>
  jsonl().flatMap((c) => {
    const words = c.text.split(" ");
    const count = c.verse_end - c.verse_start + 1;
    if (words.length < count) throw new Error(`${c.id}: too few words for the stand-in`);
    return Array.from({ length: count }, (_, i) => {
      const text = i === count - 1 ? words.slice(i).join(" ") : words[i];
      return `${c.book} ${c.chapter}:${c.verse_start + i} ${text}`;
    });
  });

describe("npm run validate (CLI)", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const missingIn = (out: string) =>
    /missing verse numbers: \d+ \((.*)\)/.exec(out)?.[1]?.split(", ") ?? [];

  /** Runs the real CLI with `args`, or with a temporary source holding `lines`. */
  function run(lines?: string[], args?: string[]) {
    const dir = mkdtempSync(join(tmpdir(), "bible-rag-validate-"));
    try {
      const file = join(dir, "source.txt");
      if (lines) writeFileSync(file, lines.join("\n"), "utf8");
      const result = spawnSync(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "ingestion/validate.ts", ...(args ?? [file])],
        { cwd: root, encoding: "utf8" },
      );
      return { status: result.status, out: result.stdout, err: result.stderr };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("chunk-integrity: exits 0 and confirms the count when the source matches", () => {
    const result = run(vpl());
    expect(result.status).toBe(0);
    expect(result.out).toContain("chunks: 8102 (expected 8102)");
    expect(result.out).toContain("validation passed");
    expect(result.err).not.toContain("NOT verified");
  });

  it("chunk-integrity: exits non-zero when a source verse is not covered", () => {
    const result = run([...vpl(), "REV 99:1 perdido"]);
    expect(result.status).toBe(1);
    expect(result.err).toContain("source verse REV 99:1 is in 0 chunks");
  });

  it("chunk-integrity: exits non-zero when an explicit source path does not exist", () => {
    const result = run(undefined, ["does/not/exist.txt"]);
    expect(result.status).toBe(1);
    expect(result.err).toContain('cannot read source VPL file "does/not/exist.txt"');
    expect(result.out).not.toContain("validation passed");
  });

  it.each([
    ["an empty path", ""],
    ["a blank path", "   "],
    ["a directory", "ingestion"],
  ])("chunk-integrity: exits non-zero for %s as source", (_, path) => {
    const result = run(undefined, [path]);
    expect(result.status).toBe(1);
    expect(result.err).toContain(`cannot read source VPL file "${path}"`);
    expect(result.out).not.toContain("validation passed");
  });

  it("chunk-integrity: exits non-zero on an empty source file", () => {
    const result = run([]);
    expect(result.status).toBe(1);
    expect(result.err).toContain("text differs from the source verses");
    expect(result.out).not.toContain("validation passed");
  });

  it("chunk-integrity: accepts a source file that starts with a BOM", () => {
    const [first, ...rest] = vpl();
    const result = run([`\uFEFF${first}`, ...rest]);
    expect(result.status).toBe(0);
    expect(result.out).toContain("validation passed");
  });

  it("chunk-integrity: --jsonl-only passes but says the source was not verified", () => {
    const result = run(undefined, ["--jsonl-only"]);
    expect(result.status).toBe(0);
    expect(result.out).toContain("chunks: 8102 (expected 8102)");
    expect(result.out).toContain("validation passed (JSONL only)");
    expect(result.err).toContain("source NOT verified (--jsonl-only)");
    expect(result.err).toContain("verse coverage, text and the 5-verse limit were not checked");
  });

  it("chunk-integrity: exits non-zero on an unknown argument", () => {
    const result = run(undefined, ["--jsonl"]);
    expect(result.status).toBe(1);
    expect(result.err).toContain("unknown or conflicting arguments");
    expect(result.err).toContain("usage: npm run validate");
    expect(result.out).toBe("");
  });

  it("chunk-integrity: exits non-zero on a malformed source line", () => {
    const lines = vpl();
    const result = run([...lines, "linha malformada"]);
    expect(result.status).toBe(1);
    expect(result.err).toContain(`source line ${lines.length + 1}: unrecognized format`);
    expect(result.err).toContain("validation FAILED: 1 error(s)");
    expect(result.out).not.toContain("validation passed");
  });

  // specs/flows/ingestion.md: verses missing in the source are listed, not errors.
  it("chunk-integrity: lists an empty source verse at the end of a chapter", () => {
    const lastOfGen1 = Math.max(
      ...jsonl()
        .filter((c) => c.book === "GEN" && c.chapter === 1)
        .map((c) => c.verse_end),
    );
    const ref = `GEN 1:${lastOfGen1 + 1}`;
    const result = run([...vpl(), ref]);
    expect(result.status).toBe(0);
    expect(missingIn(result.out)).toEqual([ref]);
  });

  it("chunk-integrity: lists a whole textless source chapter without failing", () => {
    const result = run([...vpl(), "REV 23:1", "REV 23:2"]);
    expect(result.status).toBe(0);
    expect(missingIn(result.out)).toEqual(["REV 23:1", "REV 23:2"]);
  });
});

/**
 * Runs the CLI entry point in-process with the default source faked, so the result
 * does not depend on whether ingestion/source/poronbv_vpl.txt exists locally.
 */
describe("npm run validate (default source, arguments and JSONL errors)", () => {
  const script = fileURLToPath(new URL("../ingestion/validate.ts", import.meta.url));
  const bad = "GEN 1:1 diferente";
  let dir: string;
  let good: string;
  let goodFile: string;
  let badFile: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bible-rag-validate-args-"));
    good = vpl().join("\n");
    goodFile = join(dir, "good.txt");
    badFile = join(dir, "bad.txt");
    writeFileSync(goodFile, good, "utf8");
    writeFileSync(badFile, bad, "utf8");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  afterEach(() => {
    vi.doUnmock("node:fs");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  /** Without defaultSource, reading the default path fails like a missing file. */
  async function runMain(
    options: { args?: string[]; defaultSource?: string; appendToJsonl?: string } = {},
  ) {
    const isDefault = (path: string) =>
      path.replaceAll("\\", "/").endsWith("ingestion/source/poronbv_vpl.txt");
    const reads: string[] = [];
    vi.resetModules();
    vi.doMock("node:fs", async (importOriginal) => {
      const fs = await importOriginal<typeof import("node:fs")>();
      return {
        ...fs,
        readFileSync: (path: string, encoding: "utf8") => {
          reads.push(path);
          if (isDefault(path)) {
            if (options.defaultSource !== undefined) return options.defaultSource;
            const message = `ENOENT: no such file or directory, open '${path}'`;
            throw Object.assign(new Error(message), { code: "ENOENT", path });
          }
          const content = fs.readFileSync(path, encoding);
          return path.endsWith("chunks_onbv.jsonl")
            ? content + (options.appendToJsonl ?? "")
            : content;
        },
      };
    });
    const out: string[] = [];
    const err: string[] = [];
    vi.spyOn(console, "log").mockImplementation((m: string) => void out.push(m));
    vi.spyOn(console, "warn").mockImplementation((m: string) => void err.push(m));
    vi.spyOn(console, "error").mockImplementation((m: string) => void err.push(m));
    const argv = process.argv;
    const exitCode = process.exitCode;
    try {
      process.argv = [argv[0]!, script, ...(options.args ?? [])];
      process.exitCode = 0;
      await import("../ingestion/validate");
      return {
        status: process.exitCode,
        out: out.join("\n"),
        err: err.join("\n"),
        readDefault: reads.some(isDefault),
        reads,
      };
    } finally {
      process.argv = argv;
      process.exitCode = exitCode;
    }
  }

  it("chunk-integrity: fails when there is no argument and no default source", async () => {
    const result = await runMain();
    expect(result.readDefault).toBe(true);
    expect(result.status).toBe(1);
    expect(result.err).toContain("validation FAILED: cannot read source VPL file");
    expect(result.err.replaceAll("\\", "/")).toContain("ingestion/source/poronbv_vpl.txt");
    expect(result.err).toContain("--jsonl-only validates the JSONL without verifying the source.");
    expect(result.out).not.toContain("validation passed");
  });

  it("chunk-integrity: passes with a matching default source", async () => {
    const result = await runMain({ defaultSource: good });
    expect(result.status).toBe(0);
    expect(result.out).toContain("validation passed");
    expect(result.out).not.toContain("JSONL only");
    expect(result.err).toBe("");
  });

  it("chunk-integrity: checks against the default source path when it exists", async () => {
    const result = await runMain({ defaultSource: bad });
    expect(result.status).toBe(1);
    expect(result.err).not.toContain("NOT verified");
    expect(result.err).toContain("text differs from the source verses");
  });

  it("chunk-integrity: a good explicit path wins over a bad default source", async () => {
    const result = await runMain({ args: [goodFile], defaultSource: bad });
    expect(result.status).toBe(0);
    expect(result.readDefault).toBe(false);
    expect(result.reads).toContain(goodFile);
  });

  it("chunk-integrity: a bad explicit path wins over a good default source", async () => {
    const result = await runMain({ args: [badFile], defaultSource: good });
    expect(result.status).toBe(1);
    expect(result.readDefault).toBe(false);
    expect(result.err).toContain("text differs from the source verses");
  });

  it.each(["", "does/not/exist.txt"])(
    "chunk-integrity: explicit path '%s' never falls back to the default",
    async (path) => {
      const result = await runMain({ args: [path], defaultSource: good });
      expect(result.status).toBe(1);
      expect(result.readDefault).toBe(false);
      expect(result.err).toContain("cannot read source VPL file");
      expect(result.out).not.toContain("validation passed");
    },
  );

  // "GOOD" stands for a readable, matching source file.
  it.each([
    [["--unknown"]],
    [["-h"]],
    [["-"]],
    [["--jsonl-only=true"]],
    [["--JSONL-ONLY"]],
    [["--jsonl-only", "--jsonl-only"]],
    [["--jsonl-only", "--unknown"]],
    [["--jsonl-only", "GOOD"]],
    [["GOOD", "--jsonl-only"]],
    [["--jsonl-only", ""]],
    [["", "--jsonl-only"]],
    [["GOOD", "GOOD"]],
    [["GOOD", "extra"]],
    [["GOOD", ""]],
  ])("chunk-integrity: rejects arguments %j without validating anything", async (list) => {
    const args = list.map((a) => (a === "GOOD" ? goodFile : a));
    const result = await runMain({ args, defaultSource: good });
    expect(result.status).toBe(1);
    expect(result.err).toContain("validation FAILED: unknown or conflicting arguments");
    expect(result.err).toContain("usage: npm run validate");
    expect(result.out).toBe("");
    expect(result.reads).toEqual([]);
  });

  it.each([
    ["absent", false],
    ["present", true],
  ])("chunk-integrity: --jsonl-only never reads the source (default %s)", async (_, present) => {
    const result = await runMain({
      args: ["--jsonl-only"],
      defaultSource: present ? bad : undefined,
    });
    expect(result.status).toBe(0);
    expect(result.readDefault).toBe(false);
    expect(result.out).toContain("validation passed (JSONL only)");
    expect(result.err).toContain("source NOT verified");
  });

  it("chunk-integrity: --jsonl-only still fails on a bad chunk (count, id, words)", async () => {
    const text = Array.from({ length: 121 }, () => "p").join(" ");
    const extra = { ...chunk("REV", 1, 2, text, 99), id: "REV_99_1" };
    const result = await runMain({
      args: ["--jsonl-only"],
      appendToJsonl: `\n${JSON.stringify(extra)}`,
    });
    expect(result.status).toBe(1);
    expect(result.err).toContain("chunk count is 8103, expected 8102");
    expect(result.err).toContain("REV_99_1: id does not match book, chapter and verses");
    expect(result.err).toContain("REV_99_1: 121 words, max is 120");
    expect(result.err).toContain("source NOT verified");
    expect(result.out).not.toContain("validation passed");
  });

  it.each([
    ["--jsonl-only", ["--jsonl-only"]],
    ["default source", []],
  ])("chunk-integrity: exits non-zero on a malformed JSONL line (%s)", async (_, args) => {
    const result = await runMain({ args, defaultSource: good, appendToJsonl: "\n{broken" });
    expect(result.status).toBe(1);
    expect(result.err).toMatch(/^line \d+: not a valid chunk$/m);
    expect(result.err).toContain("validation FAILED: 1 error(s)");
    expect(result.out).not.toContain("validation passed");
  });
});

describe("chunks_onbv.jsonl", () => {
  it("chunk-integrity: ids/refs follow the data model and chunking limits hold", () => {
    const url = new URL("../ingestion/chunks_onbv.jsonl", import.meta.url);
    const bad = parseChunks(readFileSync(url, "utf8")).chunks.filter((c) => {
      const single = c.verse_start === c.verse_end;
      const range = single ? `${c.verse_start}` : `${c.verse_start}-${c.verse_end}`;
      return (
        c.id !== `${c.book}_${c.chapter}_${range}` ||
        c.ref !== `${c.book} ${c.chapter}:${range}` ||
        new TextEncoder().encode(c.id).length > 64 ||
        c.verse_end - c.verse_start >= 5 ||
        (!single && c.word_count > 120)
      );
    });
    expect(bad.map((c) => c.id)).toEqual([]);
  });

  it("has the expected count, no overlaps and no numbering gaps", () => {
    const url = new URL("../ingestion/chunks_onbv.jsonl", import.meta.url);
    const parsed = parseChunks(readFileSync(url, "utf8"));
    expect(parsed.errors).toEqual([]);
    const report = validateChunks(parsed.chunks);
    expect(report.chunkCount).toBe(8102);
    expect(report.errors).toEqual([]);
    expect(report.missingVerses).toEqual([]);
  });
});
