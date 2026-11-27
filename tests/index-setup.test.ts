import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";
import { EMBEDDING_DIMENSION, VECTOR_METRIC } from "../src/config";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

// Parsed and validated by wrangler itself (local only, no account access).
const wrangler = unstable_readConfig({
  config: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
});
const commands = read("../specs/flows/ingestion.md")
  .split(/\r?\n/)
  .filter((line) => line.startsWith("npx wrangler vectorize "));

/** `| `field` | type | yes |` rows of the data model metadata table. */
const indexedFields = [
  ...read("../specs/design/data-model.md").matchAll(
    /^\| `(\w+)` \| (\w+) \| yes \|/gm,
  ),
].map(([, name, type]) => `${name}:${type}`);

describe("S05a Vectorize index setup", () => {
  it("real-vectorize: wrangler config binds VECTORIZE to one real index", () => {
    expect(wrangler.vectorize).toEqual([
      { binding: "VECTORIZE", index_name: "bible-onbv" },
    ]);
  });

  it("real-vectorize: create command uses the bound index and config values", () => {
    const create = commands.filter((c) => / vectorize create /.test(c));
    expect(create).toHaveLength(1);
    const args = create[0]!.split(/\s+/);
    expect(args[4]).toBe(wrangler.vectorize[0]!.index_name);
    expect(args).toContain(`--dimensions=${EMBEDDING_DIMENSION}`);
    expect(args).toContain(`--metric=${VECTOR_METRIC}`);
  });

  it("real-vectorize: metadata index commands match the data model", () => {
    const documented = commands
      .filter((c) => c.includes(" create-metadata-index "))
      .map((c) => {
        expect(c.split(/\s+/)[4]).toBe(wrangler.vectorize[0]!.index_name);
        const name = /--propertyName=(\w+)/.exec(c)?.[1];
        const type = /--type=(\w+)/.exec(c)?.[1];
        return `${name}:${type}`;
      });
    expect(indexedFields).toHaveLength(4);
    expect(documented.sort()).toEqual([...indexedFields].sort());
  });

  it("real-vectorize: the index is created before its metadata indexes", () => {
    const first = commands.findIndex((c) => / vectorize create /.test(c));
    const meta = commands.findIndex((c) => c.includes("create-metadata-index"));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(meta).toBeGreaterThan(first);
  });

  it("real-vectorize: verification commands follow setup and target the bound index", () => {
    const subcommands = commands.map((c) => c.split(/\s+/)[3]);
    const lastSetup = subcommands.lastIndexOf("create-metadata-index");
    for (const verify of ["get", "list-metadata-index", "info"]) {
      expect(subcommands.indexOf(verify)).toBeGreaterThan(lastSetup);
    }
    for (const command of commands) {
      expect(command.split(/\s+/)[4]).toBe(wrangler.vectorize[0]!.index_name);
    }
  });

  it("real-vectorize: the create command does not let wrangler edit the config", () => {
    const create = commands.find((c) => / vectorize create /.test(c));
    expect(create).toContain("--update-config=false");
  });
});
