# Ingestion flow

Does not run on every question. It is a separate process, run locally by
the developer. Steps, in order:

- **Download** ONBV from eBible and record provenance and license
  (`ATTRIBUTION.md`).
- **Generate** `chunks_onbv.jsonl` with the chunking script *(done)*.
- **Validate** the chunks:
  - 66 books present, in canonical order;
  - every source verse appears in **exactly one** chunk (no gaps or
    overlaps);
  - non-empty `text`; unique `id`; consistent `word_count`;
  - verses missing in the source itself (common in modern translations)
    are listed and documented, not treated as errors.

  The command also checks that `id` and `ref` match the book, chapter and
  verse range ([data model](../design/data-model.md)) and the limits of the
  [chunking rules](../design/chunking.md): at most 120 words per chunk
  (except a single verse that alone exceeds it) and at most 5 verses
  (counted on source verses).

  Run `npm run validate -- <path to poronbv_vpl.txt>` (default path:
  `ingestion/source/poronbv_vpl.txt`, ignored by Git). The command fails if
  the source file cannot be read, including an explicit empty path, and on
  unknown or conflicting arguments. `npm run validate -- --jsonl-only`
  checks just the JSONL and warns that the source was **not** verified
  (coverage, text and the 5-verse limit); it does not replace the full
  validation. Source-verified result on 2026-11-27 (`poronbv_vpl.txt`):
  8,102 chunks, no errors, 0 missing verse numbers.
- **Count** chunks and confirm model/dimension
  ([dimension budget](../design/dimension-budget.md)). **Decide the
  EmbeddingGemma prefixes now** (test with and without): this must be
  settled before any vector is created.
- **Create** the Vectorize index with the right dimension and metric, plus
  the metadata indexes (before inserting any vector).
- **Embed** in batches via Workers AI (Cloudflare REST API, called by
  `ingest.ts` with `fetch`, run via `tsx`, and an API token with Workers AI and Vectorize
  permission, kept in a local environment variable).
- **Upsert** into Vectorize via the HTTP API (batches of up to 5,000
  vectors, NDJSON).
- **Wait and verify:** Vectorize mutations are asynchronous. Poll the index
  info until the vector count equals the number of lines in
  `chunks_onbv.jsonl` before testing.
- **Smoke test** with queries and check the returned references.

## Index setup commands

Run **once**, by the developer, from the repository root and **before**
ingestion. They change the Cloudflare account, so authenticate first with
`npx wrangler login` (or a `CLOUDFLARE_API_TOKEN` environment variable with
Vectorize edit permission; never commit it).

The index is `bible-onbv`, bound as `VECTORIZE` in `wrangler.jsonc`.
Dimension and metric are `EMBEDDING_DIMENSION` and `VECTOR_METRIC` in
`src/config.ts`; the metadata indexes are the ones marked in the
[data model](../design/data-model.md#metadata-stored-in-vectorize-per-vector).
Dimension and metric cannot be changed after creation.

```bash
npx wrangler vectorize create bible-onbv --dimensions=512 --metric=cosine --update-config=false
npx wrangler vectorize create-metadata-index bible-onbv --propertyName=book --type=string
npx wrangler vectorize create-metadata-index bible-onbv --propertyName=testament --type=string
npx wrangler vectorize create-metadata-index bible-onbv --propertyName=chapter --type=number
npx wrangler vectorize create-metadata-index bible-onbv --propertyName=verse_start --type=number
```

`--update-config=false` keeps wrangler from editing the configuration, which
already has the binding.

Then verify. Metadata index creation is also asynchronous: do not start
ingestion until all four properties are listed with the right types.

```bash
npx wrangler vectorize get bible-onbv                  # dimensions 512, metric cosine
npx wrangler vectorize list-metadata-index bible-onbv  # the 4 properties
npx wrangler vectorize info bible-onbv                 # vector count 0
```

## What is shared with the Worker

Ingestion calls Workers AI over **REST** (`fetch`) while the Worker uses the
`env.AI` binding, so the transport differs. `embeddings.ts` must therefore
separate:

- **pure functions** shared by both (prefix application, truncation to N
  dimensions, L2 normalization, constants from `config.ts`), with no
  runtime or network dependency; and
- **transport adapters** (REST in `ingest.ts`, binding in the Worker via
  `env.ts`).

A test must embed the same text through both paths (or a recorded fixture)
and assert identical post-processed vectors.

## Idempotency and resumption

Use `upsert` with the chunk `id` so reruns do not create duplicates. Write
a local checkpoint (last completed batch), because the daily Neurons
allowance may force splitting ingestion over more than one day. Before
running everything, measure the Neuron consumption of a small batch in the
dashboard and estimate the total. Ingestion shares the account's daily
Neurons with the production API: avoid ingesting while the API is in use,
or leave margin.

## Re-ingestion and index versioning

Upsert by `id` is idempotent **only while chunk ids are unchanged**. If
chunking rules, the model, the dimension, truncation or prefixes change:

- do **not** upsert over the existing index (old ids would remain as orphans,
  creating duplicates and overlaps; incompatible vectors would be mixed);
- **delete the old index first, then create a new one** (e.g.
  `bible-onbv-v2`), ingest, verify and point the `VECTORIZE` binding in
  `wrangler.jsonc` to it before deploying. The 5 M stored dimensions are
  **account-wide** and two full indexes (~4.15 M each at 512 dimensions)
  never fit together on Free, so a side-by-side swap is not possible.
- **There is no rollback by keeping the old index.** Recovery means
  re-ingesting from the versioned `chunks_onbv.jsonl`, so keep that file and
  the ingestion checkpoint. Expect the API to be down or empty of results
  between the deletion and the end of verification; plan the window
  (ingestion may span more than one day because of the Neurons allowance).
- Changes that keep ids and vectors (e.g. adding `prev_id`/`next_id`
  metadata) may be re-upserted in place.
