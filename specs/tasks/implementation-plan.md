# Implementation plan

Planning and execution tracker. Technical details live in the Spec
documents ([requirements](../requirements/), [design](../design/),
[contracts](../contracts/), [flows](../flows/)), limits in
[non-goals](../non-goals.md) and principles in
[constitution](../constitution.md); this file only sequences the work.

## Execution rules

- Execute the steps in the defined order, respecting their dependencies.
- Do not advance to the next step while the current step has pending
  acceptance criteria.
- Update step statuses as implementation progresses.
- Record architectural decisions and technical details in the respective
  Spec documents, avoiding duplication in this roadmap.
- If implementation reveals a conflict with the Spec, resolve the
  inconsistency in the documentation before proceeding.

## Step sizing

Each step must be small enough for one working session and one reviewable
diff. A step is the right size when:

- it can be described in one sentence without "and";
- it has 1–3 verifiable acceptance criteria (the **AC** column);
- it touches roughly 1–3 new files plus their tests.

If a step grows beyond that during execution, split it here before
continuing. Steps that depend on real measurements (S10) end with a
numeric or recorded exit condition so they cannot loop indefinitely.

## Definition of done

A step is considered done only when:

- Its implementation is functional.
- Its matching [acceptance criteria](../requirements/acceptance-criteria.md)
  (the **AC** column) are met.
- The applicable tests pass.
- The related documentation is up to date.

## Acceptance criteria tags

The AC column uses these short tags, one per criterion in
[acceptance-criteria.md](../requirements/acceptance-criteria.md):

| Tag | Criterion |
| --- | --------- |
| `deploy` | API published on Cloudflare Workers |
| `swagger` | `/docs` lists endpoints with examples, error codes, auth |
| `attr-file` | ONBV source and license in `ATTRIBUTION.md` |
| `attr-resp` | `attribution` block in responses; OpenAPI notice |
| `auth` | `X-API-Key` required; rate limit exists |
| `tests` | Vitest passes with fake services/`env` |
| `errors` | Every error returns `{"detail": "<string>"}`; `401` for bad key |
| `attr-sync` | `attribution.ts` matches `ATTRIBUTION.md` (test) |
| `chunk-integrity` | Every verse in exactly one chunk; no duplicates; index count = chunk count |
| `ref-lookup` | Explicit reference returns the chunk with that verse |
| `neurons` | Evaluation records Neurons per answer and daily capacity |
| `budget` | Chunks × dimension fits in 5 M stored dimensions |
| `fr-search` | Search returns correct references, Portuguese book names |
| `fr-references` | Answer presents retrieved sources |
| `fr-no-context` | System admits insufficient context |
| `same-model` | Workers AI embeddings/generation, same model/dimension at ingestion and query |
| `real-vectorize` | Vectorize used as a real vector database |
| `grounding` | Answers rely only on retrieved passages; disclaimer present |
| `privacy` | CORS off by default; logs hold no question, answer or key |
| `eval-safety` | Evaluation covers injection and sensitive questions |
| `error-map` | `502` / `504` / `503` mapping; `404` with standard body |
| `monitor` | Usage monitorable in the Cloudflare dashboard |
| `no-secrets` | No key/credential in the repository |

## Steps

Steps in execution order. Dependencies list only real technical
prerequisites; steps with no dependency can start at any time, and
independent steps (for example S08/S09 and S10) can run in parallel.

| ID | Step | Description | AC | Dependencies | Status |
| -- | ---- | ----------- | -- | ------------ | ------ |
| S01a | Data: text | Obtain the ONBV text | — | None | done |
| S01b | Data: attribution | Write `ATTRIBUTION.md` (source, CC BY-SA 4.0, marked section for the sync test) | `attr-file` | S01a | done |
| S02 | Chunking | Generate `chunks_onbv.jsonl` (8,102 chunks) | — | S01a | done |
| S03a | Scaffold | Project scaffold: `package.json`, `tsconfig`, wrangler config, Vitest, `tsx`. The platform spike was skipped (2026-11-18); see [platform](../design/cloudflare-platform.md) | `tests`, `no-secrets` | None | done |
| S03b | Move ingestion files | Move `chunk_bible.py` and `chunks_onbv.jsonl` into `ingestion/` and adjust paths | — | None | done |
| S03c | Config and books | `config.ts` (model, dimension, `top_k`, threshold, prefixes as parameters) and `books.ts` (Portuguese book names) | `fr-search` | S03a | pending |
| S03d | Embeddings core | Pure `services/embeddings.ts`: prefix, truncation, L2 norm; Vitest | `same-model`, `tests` | S03a, S03c | pending |
| S04a | Coverage validation | `validate.ts`: every verse in exactly one chunk, confirm chunk count | `chunk-integrity` | S02, S03a | pending |
| S04b | Model and prefixes | Confirm model/dimension (512 decided), **decide EmbeddingGemma prefixes** and record them in `config.ts` ([budget](../design/dimension-budget.md)) | `budget` | S03c, S03d | pending |
| S05a | Index setup | Create the Vectorize index and metadata indexes (external effect; record the commands) | `real-vectorize` | S04b | pending |
| S05b | Ingestion | `ingest.ts`: generate embeddings, upsert in batches, verify index count = chunk count (shared pure `embeddings.ts`) | `chunk-integrity`, `same-model`, `no-secrets` | S04a, S05a | pending |
| S06a | Retrieval: query | `retrieval.ts`: embed query, filters, threshold; Vitest with fake services | `fr-search`, `fr-no-context`, `tests` | S03d, S05b | pending |
| S06b | Retrieval: reference | Reference lookup ("João 3:16" → chunk containing the verse) | `ref-lookup` | S06a | pending |
| S06c | Retrieval: merge | Adjacent chunk merge | `fr-references` | S06a | pending |
| S06d | Search endpoint | `POST /api/search` on the S03a scaffold | `fr-search` | S06b, S06c | pending |
| S07a | Prompt and generation | `generation.ts` + prompt rules (grounding, disclaimer, no-context answer); Vitest with fake services | `grounding`, `fr-no-context`, `tests` | S06a | pending |
| S07b | Chat endpoint | `POST /api/chat` returning the answer with its retrieved sources | `fr-references`, `same-model` | S06d, S07a | pending |
| S08a | Schemas and errors | Zod schemas and unified error handlers (`{"detail": ...}`, `404`, validation) | `errors`, `error-map` | S06d, S07b | pending |
| S08b | Attribution and OpenAPI | `attribution.ts` constant + sync test; attribution block in responses; examples and notice in OpenAPI (`/docs`) | `attr-resp`, `attr-sync`, `swagger` | S01b, S08a | pending |
| S09a | Authentication | `X-API-Key` (constant-time, `401`) | `auth`, `errors` | S08a | pending |
| S09b | Rate limit and CORS | Rate limit (per IP + global), CORS off, order auth → rate limit → validation | `auth`, `privacy` | S09a | pending |
| S10a | Question set | `questions.json`: known, ambiguous, off-topic, sensitive, injection and explicit-reference questions with expected behavior | `eval-safety` | S07b | pending |
| S10b | Calibration | Calibrate `top_k` and the `context_found` threshold on the set. Exit: values recorded in `config.ts` after at most 2 tuning rounds, or the remaining gap documented | `fr-no-context`, `ref-lookup` | S10a | pending |
| S10c | Capacity measurement | Measure Neurons per answer, derive daily capacity of `/api/chat`; measure citations outside `sources` | `neurons`, `grounding` | S10b | pending |
| S11 | README | Model, dimension, truncation, metric, prefixes, chunk count, generation model, capacity estimate, privacy/logging note | `privacy` | S10c | pending |
| S12 | Deploy | `wrangler deploy`, set `API_KEY` as a Worker secret, confirm usage in the dashboard | `deploy`, `monitor`, `no-secrets` | S08b, S09b, S10c, S11 | pending |
