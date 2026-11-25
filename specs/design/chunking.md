# Chunking strategy (already implemented)

Rules applied by the chunking script:

- Whole verses only (never cuts a verse in half).
- Max 5 verses per chunk.
- Max 120 words per chunk (concatenated text). Exception: a verse that
  alone exceeds 120 words becomes its own chunk.
- Never mixes chapters or books in the same chunk.
- Every source verse is in exactly one chunk: chunks **never overlap**.

Current output: **8,102 chunks** (see [dimension budget](dimension-budget.md)).

## At search time

- Retrieve the most relevant chunks (suggestion: top 5 to 8; each chunk
  already carries up to 5 verses of context).
- Because chunks never overlap, there is nothing to "deduplicate". What can
  happen is that two retrieved chunks are **adjacent** (same book and
  chapter, `verse_end + 1 == verse_start`): merge them into one passage
  (single reference range, `score` = max of the two) before building the
  prompt. Merging must not exceed the prompt budget.
- If needed, expand context with neighboring chunks of the same chapter. A
  simple improvement in the chunking script: write `prev_id` and `next_id` in
  each line and fetch them with `getByIds`. This does **not** change chunk
  `id`s, but the metadata must be re-upserted (see
  [ingestion](../flows/ingestion.md), re-ingestion). Optional; not needed
  for the MVP and not part of the query flow. If added, expanded passages
  must appear in `sources`.

## Changing the chunking rules

Any change to chunk boundaries changes `id`s and invalidates the existing
index. It requires re-validation and a **new index** (or full wipe), never
an in-place upsert; see
[ingestion → Re-ingestion](../flows/ingestion.md#re-ingestion-and-index-versioning).

## Future evaluation

Compare with smaller chunks (1 to 3 verses), as long as they fit the
[dimension budget](dimension-budget.md).
