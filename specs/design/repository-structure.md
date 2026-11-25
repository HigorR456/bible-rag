# Suggested repository structure

```text
bible-rag/
├── specs/                    # these specifications (SDD)
├── src/
│   ├── index.ts              # Worker entry: export default app
│   ├── app.ts                # OpenAPIHono instance, OpenAPI metadata, route registration, error handlers
│   ├── env.ts                # Env bindings type + adapters building Embedder/VectorStore/Generator from bindings
│   ├── config.ts             # model, dimension, topK, threshold, limits
│   ├── schemas.ts            # Zod request/response schemas (also OpenAPI)
│   ├── books.ts              # USFM -> PT name, canonical order, testament
│   ├── attribution.ts        # ONBV attribution block
│   ├── middleware/
│   │   ├── auth.ts           # X-API-Key check (constant time)
│   │   └── rateLimit.ts
│   ├── routes/
│   │   ├── chat.ts           # POST /api/chat
│   │   ├── search.ts         # POST /api/search
│   │   └── health.ts         # GET /api/health
│   ├── services/
│   │   ├── embeddings.ts     # PURE shared functions: prefix, truncation, L2 norm (no transport)
│   │   ├── retrieval.ts      # Vectorize queries
│   │   └── generation.ts     # answer generation
│   └── prompts/
│       └── bibleAssistant.ts
├── ingestion/
│   ├── source/               # original ONBV file (do not version if large)
│   ├── chunk_bible.py        # Python chunking script (exists; run once, outside the app; S03b moves it here from the repo root)
│   ├── chunks_onbv.jsonl     # chunking output (CC BY-SA 4.0; S03b moves it here from the repo root)
│   ├── validate.ts           # coverage, duplicates, 66 books
│   └── ingest.ts             # REST transport (fetch) for embeddings + upsert with checkpoint; imports pure functions from ../src/services/embeddings
├── tests/
│   ├── api.test.ts           # app.request() with fake services/env
│   ├── retrieval.test.ts
│   └── questions.json        # evaluation questions + expected references
├── ATTRIBUTION.md            # ONBV copyright notice + changes made
├── package.json              # deps (hono, @hono/zod-openapi, @hono/swagger-ui, zod) and dev (wrangler, vitest, typescript, tsx)
├── tsconfig.json
├── wrangler.toml             # AI and VECTORIZE bindings, vars, compat date (or wrangler.jsonc)
└── README.md
```

## Dependency rule

Code in `src/` must not import anything specific to the Cloudflare runtime
(binding types, `cloudflare:*` modules) outside `index.ts` and `env.ts`.
Services depend on narrow interfaces (`Embedder`, `VectorStore`,
`Generator`), not on `c.env`. This way tests run locally with Vitest and
`app.request()`, with fakes injected.

## Shared embedding code

`src/services/embeddings.ts` holds only **pure functions** (prefix
application, truncation to N dimensions, L2 normalization) and constants
from `config.ts`. It has no network or runtime dependency. The **transport
adapters** live elsewhere: REST (`fetch`) in `ingestion/ingest.ts`, and the
`env.AI` binding in the Worker via `env.ts`. See
[ingestion flow](../flows/ingestion.md#what-is-shared-with-the-worker).

`ingestion/*.ts` imports these modules by **relative path** from `../src`
and runs with `tsx`, so no package or workspace setup is needed. It must not
import `index.ts` or `env.ts` (Cloudflare runtime).

The structure is a suggestion; it can be simplified for the first
prototype.
