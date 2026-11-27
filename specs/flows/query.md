# Question flow

Steps, in order:

- The client sends `POST /api/chat` with the question.
- **Authentication** (`X-API-Key`) and **rate limit** run first, as
  middleware ([access and protection](../contracts/access-and-protection.md)).
  Then Hono validates input with Zod (question trimmed, min/max
  length, `top_k` in range, valid `book`/`testament`) and returns `422`
  when invalid.
- **Embedding:** Workers AI embeds the question once, with **the same
  model, the same dimension/truncation and the same prefixes** as
  ingestion. This single vector is reused by the reference lookup and by
  the semantic query below.
- **Reference detection:** if the question contains an explicit reference,
  parse it using the book table. Supported forms: a single verse
  ("João 3:16", "Jo 3.16") or a verse range within one chapter of up to 5
  verses ("Mateus 6:14-15"). Matching is accent- and case-insensitive and
  accepts full Portuguese names, book codes and the abbreviations listed in
  `books.ts`. **Ambiguous abbreviations** (e.g. "Jo" for João/Jó, "Jd" for
  Judas/Juízes) are **not** in the table and are not recognized. **Not
  supported** (ignored, semantic search only): a whole chapter ("João 3"),
  ranges across chapters or longer than 5 verses; with **several references
  in one question** only the first valid one is used. When found, retrieve
  the chunk(s) overlapping the reference: Vectorize query with metadata
  filter `book`, `chapter` and `verse_start <= last verse`, then keep the
  chunks whose range overlaps the reference. They are added to the context
  in addition to the semantic results ("explain John 3:16 using other
  passages"). If the reference does not exist, ignore it and continue with
  semantic search only.
  - **Request filters:** if the request has `book`/`testament` and the
    reference does not satisfy them, the reference is ignored; the request
    filters always apply.
  - Vectorize has no pure metadata lookup: `query` needs a vector and
    orders by similarity, not by `verse_start`. Run the query with the
    question embedding (computed in the previous step), `topK: 50` (the max with
    `returnMetadata: "all"`; enough for the largest chapter, Psalm 119, at
    36 chunks in the current index) and the filter above, then pick the
    matching chunk(s) **client-side** by range overlap. This is a second
    Vectorize query per request (see the
    [dimension budget](../design/dimension-budget.md)).
  - The reference chunk **bypasses the similarity threshold** and counts as
    context: a question like "João 3:16" returns `context_found: true`
    even if no semantic result clears the threshold. Reference chunk(s) take
    the first slots of `sources` (in verse order, at most `top_k`). Semantic
    results fill the remaining slots. If a reference chunk also appears in
    the semantic results it is kept **once**, in the reference position.
- The Worker queries Vectorize (`topK` = the request's `top_k`, default 6,
  max 8; `returnMetadata: "all"`),
  applying the optional `book`/`testament` filters from the request.
- Passages below the similarity threshold (`SIMILARITY_THRESHOLD` in
  `config.ts`; S06a uses a provisional value from a few manual queries,
  calibrated in S10b) are discarded. If none remain →
  `context_found: false`, an "insufficient context" answer, **without
  calling the LLM**.
- Post-retrieval: merge **adjacent** chunks ([chunking](../design/chunking.md))
  and cap the number of passages and the prompt size. Neighbor expansion is
  **not** part of the MVP; if added later, expanded passages become part of
  `sources` (what is sent to the LLM is what is returned).
- The Worker builds the prompt with question (delimited as untrusted
  input), passages and Portuguese references (via the book table),
  following the [prompt rules](../contracts/prompt.md).
- Workers AI generates an answer based exclusively on the retrieved
  context. A timeout maps to `504`; other failures to `502`.
- The API returns the answer, sources, attribution and disclaimer
  ([contract](../contracts/api-endpoints.md)).

## `/api/search`

Same steps, stopping after retrieval, threshold and adjacent-chunk merge:
no prompt and no LLM. Returns `context_found` and `sources`.
