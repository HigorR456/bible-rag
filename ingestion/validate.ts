/**
 * Coverage validation of the chunks (specs/flows/ingestion.md, "Validate").
 *
 *   npm run validate [-- <source VPL file>]
 *   npm run validate -- --jsonl-only
 *
 * Every source verse is matched against exactly one chunk, so the command fails
 * without the original VPL file. --jsonl-only checks just the JSONL itself.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { BOOK_CODES } from "../src/books";

/** Measured count (specs/design/dimension-budget.md). */
export const EXPECTED_CHUNK_COUNT = 8102;

/** Chunking limits (specs/design/chunking.md). */
const MAX_VERSES = 5;
const MAX_WORDS = 120;

const chunkSchema = z.object({
  id: z.string().min(1),
  ref: z.string().min(1),
  book: z.string().min(1),
  chapter: z.int().positive(),
  verse_start: z.int().positive(),
  verse_end: z.int().positive(),
  word_count: z.int().nonnegative(),
  text: z.string(),
});

export type Chunk = z.infer<typeof chunkSchema>;

export interface SourceVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface ValidationReport {
  chunkCount: number;
  errors: string[];
  /** Verse numbers without text ("GEN 1:3"). Documented, not errors. */
  missingVerses: string[];
  sourceChecked: boolean;
}

/** Parses the JSONL; invalid lines become errors instead of throwing. */
export function parseChunks(jsonl: string): { chunks: Chunk[]; errors: string[] } {
  const chunks: Chunk[] = [];
  const errors: string[] = [];
  jsonl.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    try {
      chunks.push(chunkSchema.parse(JSON.parse(line)));
    } catch {
      errors.push(`line ${i + 1}: not a valid chunk`);
    }
  });
  return { chunks, errors };
}

export interface ParsedSource {
  verses: SourceVerse[];
  /** References with no text ("GEN 1:3"): missing in the source itself. */
  emptyRefs: string[];
  errors: string[];
}

/**
 * Parses the VPL source like chunk_bible.py does. Unlike the script, which
 * skips them silently, unrecognized lines are reported.
 */
export function parseSource(vpl: string): ParsedSource {
  const verses: SourceVerse[] = [];
  const emptyRefs: string[] = [];
  const errors: string[] = [];
  vpl.replace(/^\uFEFF/, "").split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = /^([\p{L}\p{N}_]{3})\s+(\d+):(\d+)(?:\s+(.*))?$/u.exec(line);
    if (!m) {
      errors.push(`source line ${i + 1}: unrecognized format`);
      return;
    }
    const text = (m[4] ?? "").trim();
    const verse = { book: m[1]!, chapter: Number(m[2]), verse: Number(m[3]), text };
    if (text) verses.push(verse);
    else emptyRefs.push(`${chapterKey(verse.book, verse.chapter)}:${verse.verse}`);
  });
  return { verses, emptyRefs, errors };
}

const chapterKey = (book: string, chapter: number) => `${book} ${chapter}`;

function groupByChapter<T extends { book: string; chapter: number }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = chapterKey(item.book, item.chapter);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** All 66 books, each in one contiguous block, in canonical order. */
function checkBooks(chunks: Chunk[]): string[] {
  const runs = chunks.map((c) => c.book).filter((b, i, all) => b !== all[i - 1]);
  const known = new Set<string>(BOOK_CODES);
  const present = new Set(runs);
  const errors = [
    ...BOOK_CODES.filter((b) => !present.has(b)).map((b) => `missing book: ${b}`),
    ...[...present].filter((b) => !known.has(b)).map((b) => `unknown book: ${b}`),
  ];
  if (errors.length === 0 && runs.join() !== BOOK_CODES.join()) {
    errors.push("books are not in canonical order");
  }
  return errors;
}

function checkFields(chunks: Chunk[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const c of chunks) {
    if (ids.has(c.id)) errors.push(`duplicate id: ${c.id}`);
    ids.add(c.id);
    const words = c.text.trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) errors.push(`${c.id}: empty text`);
    if (c.word_count !== words) {
      errors.push(`${c.id}: word_count is ${c.word_count}, text has ${words}`);
    }
    if (c.verse_end < c.verse_start) errors.push(`${c.id}: verse_end before verse_start`);
    const single = c.verse_start === c.verse_end;
    const range = single ? `${c.verse_start}` : `${c.verse_start}-${c.verse_end}`;
    if (c.id !== `${c.book}_${c.chapter}_${range}`) {
      errors.push(`${c.id}: id does not match book, chapter and verses`);
    }
    if (c.ref !== `${c.book} ${c.chapter}:${range}`) {
      errors.push(`${c.id}: ref does not match book, chapter and verses`);
    }
    // Only a verse that alone exceeds the limit may do so.
    if (!single && words > MAX_WORDS) {
      errors.push(`${c.id}: ${words} words, max is ${MAX_WORDS}`);
    }
  }
  return errors;
}

function checkOverlaps(chunks: Chunk[]): string[] {
  const errors: string[] = [];
  for (const group of groupByChapter(chunks).values()) {
    let previous: Chunk | undefined;
    for (const c of [...group].sort((a, b) => a.verse_start - b.verse_start)) {
      if (previous && c.verse_start <= previous.verse_end) {
        errors.push(`overlap: ${previous.id} and ${c.id}`);
      }
      if (!previous || c.verse_end > previous.verse_end) previous = c;
    }
  }
  return errors;
}

/**
 * Each source verse in exactly one chunk, with the chunk text matching it and
 * the range starting and ending on verses the chunk contains.
 */
function checkSource(chunks: Chunk[], verses: SourceVerse[]): string[] {
  const errors: string[] = [];
  const chunkGroups = groupByChapter(chunks);
  const verseGroups = groupByChapter(verses);
  const contains = (c: Chunk, v: number) => v >= c.verse_start && v <= c.verse_end;

  for (const [key, group] of verseGroups) {
    const seen = new Set<number>();
    for (const { verse } of group) {
      if (seen.has(verse)) errors.push(`source verse repeated: ${key}:${verse}`);
      seen.add(verse);
      const n = (chunkGroups.get(key) ?? []).filter((c) => contains(c, verse)).length;
      if (n !== 1) errors.push(`source verse ${key}:${verse} is in ${n} chunks`);
    }
  }
  for (const [key, group] of chunkGroups) {
    for (const c of group) {
      const contained = (verseGroups.get(key) ?? []).filter((v) => contains(c, v.verse));
      // Counted on source verses: a range may span numbers without text.
      if (contained.length > MAX_VERSES) {
        errors.push(`${c.id}: ${contained.length} verses, max is ${MAX_VERSES}`);
      }
      const expected = contained.map((v) => v.text).join(" ");
      if (c.text !== expected) errors.push(`${c.id}: text differs from the source verses`);
      const first = contained[0]?.verse;
      const last = contained.at(-1)?.verse;
      if (contained.length && (c.verse_start !== first || c.verse_end !== last)) {
        errors.push(
          `${c.id}: range is ${c.verse_start}-${c.verse_end}, source verses are ${first}-${last}`,
        );
      }
    }
  }
  return errors;
}

/** Numbers between 1 and the last verse of each chapter that nothing covers. */
function findGaps(ranges: { book: string; chapter: number; from: number; to: number }[]) {
  const missing: string[] = [];
  for (const [key, group] of groupByChapter(ranges)) {
    let next = 1;
    for (const { from, to } of group.sort((a, b) => a.from - b.from)) {
      for (; next < from; next++) missing.push(`${key}:${next}`);
      next = Math.max(next, to + 1);
    }
  }
  return missing;
}

export function validateChunks(
  chunks: Chunk[],
  options: { expectedCount?: number; source?: SourceVerse[]; emptyRefs?: string[] } = {},
): ValidationReport {
  const { expectedCount = EXPECTED_CHUNK_COUNT, source, emptyRefs = [] } = options;
  const errors = [...checkBooks(chunks), ...checkFields(chunks), ...checkOverlaps(chunks)];
  if (chunks.length !== expectedCount) {
    errors.push(`chunk count is ${chunks.length}, expected ${expectedCount}`);
  }
  if (source) errors.push(...checkSource(chunks, source));
  const ranges = source
    ? source.map((v) => ({ ...v, from: v.verse, to: v.verse }))
    : chunks.map((c) => ({ ...c, from: c.verse_start, to: c.verse_end }));
  return {
    chunkCount: chunks.length,
    errors,
    // Gaps stop at the last verse with text; empty references cover the rest.
    missingVerses: [...new Set([...findGaps(ranges), ...emptyRefs])],
    sourceChecked: source !== undefined,
  };
}

const USAGE = "usage: npm run validate [-- <source VPL file> | --jsonl-only]";

/** At most one of: a source path (even an empty one) or --jsonl-only. */
function parseArgs(args: string[]): { jsonlOnly: boolean; sourcePath?: string } | undefined {
  const [arg, ...rest] = args;
  if (rest.length) return undefined;
  if (arg === "--jsonl-only") return { jsonlOnly: true };
  if (arg?.startsWith("-")) return undefined;
  return { jsonlOnly: false, sourcePath: arg };
}

function readSource(path: string): ParsedSource | undefined {
  try {
    return parseSource(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function main(args: string[]): void {
  const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
  const options = parseArgs(args);
  if (!options) {
    console.error(`validation FAILED: unknown or conflicting arguments
${USAGE}`);
    process.exitCode = 1;
    return;
  }

  let source: ParsedSource | undefined;
  if (!options.jsonlOnly) {
    // ?? keeps an explicit empty path, which must fail instead of falling back.
    const sourcePath = options.sourcePath ?? here("./source/poronbv_vpl.txt");
    source = readSource(sourcePath);
    if (!source) {
      console.error(
        `validation FAILED: cannot read source VPL file "${sourcePath}"
` +
          `${USAGE}
--jsonl-only validates the JSONL without verifying the source.`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const parsed = parseChunks(readFileSync(here("./chunks_onbv.jsonl"), "utf8"));
  const report = validateChunks(parsed.chunks, {
    source: source?.verses,
    emptyRefs: source?.emptyRefs,
  });
  const errors = [...parsed.errors, ...(source?.errors ?? []), ...report.errors];

  console.log(`chunks: ${report.chunkCount} (expected ${EXPECTED_CHUNK_COUNT})`);
  console.log(
    `missing verse numbers: ${report.missingVerses.length}` +
      (report.missingVerses.length ? ` (${report.missingVerses.join(", ")})` : ""),
  );
  if (!report.sourceChecked) {
    console.warn(
      `WARNING: source NOT verified (--jsonl-only): verse coverage, text and the ` +
        `${MAX_VERSES}-verse limit were not checked.`,
    );
  }
  if (errors.length) {
    for (const error of errors.slice(0, 50)) console.error(error);
    console.error(`validation FAILED: ${errors.length} error(s)`);
    process.exitCode = 1;
  } else {
    console.log(`validation passed${report.sourceChecked ? "" : " (JSONL only)"}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
