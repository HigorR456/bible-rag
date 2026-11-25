# Cloudflare platform (free tier)

| Component       | Service                                          | Responsibility                                      |
| --------------- | ------------------------------------------------ | --------------------------------------------------- |
| API/backend     | **Cloudflare Workers (Free) + Hono (TypeScript)** | Receive questions, validate input, orchestrate search and generation, serve Swagger |
| Vector database | **Cloudflare Vectorize (Free allowance)**        | Store and search embeddings                         |
| Embeddings      | **Cloudflare Workers AI (Free allowance)**       | Turn chunks and questions into vectors              |
| Language model  | **Cloudflare Workers AI (Free allowance)**       | Generate the answer from retrieved passages         |

## Hono on Cloudflare Workers

- The API is **TypeScript + Hono** on the standard (V8) Workers runtime.
  The Worker entry point is the Hono app itself: `export default app`.
- Bindings (Workers AI and Vectorize) reach routes through `c.env`, e.g.
  `c.env.AI.run(...)` and `c.env.VECTORIZE.query(...)`. Type them once with
  `Hono<{ Bindings: Env }>`. Services never receive `c.env` directly: they
  receive narrow interfaces (`Embedder`, `VectorStore`, `Generator`) built
  from the bindings in `src/env.ts`, so tests pass plain fakes. There is no
  language boundary, so no conversion cost.
- Validation and OpenAPI: **Zod** schemas with `@hono/zod-openapi`
  (`OpenAPIHono`). One schema is the request validator, the TypeScript type
  and the OpenAPI definition. Swagger UI is served by `@hono/swagger-ui`.
- Dev and deploy tool: **wrangler** (`wrangler dev`, `wrangler deploy`),
  with `npm` (or `pnpm`) and `package.json`. Types for bindings come from
  `wrangler types`.
- Tests: **Vitest**, calling `app.request(...)` with fake services/env (no
  Cloudflare runtime needed).
- Everything is `async` and uses Web-standard APIs (`fetch`, `crypto`);
  avoid Node-only modules in `src/`.

## Known risk: 10 ms CPU per request on Free

Decision (2026-11-18, still valid): **no upfront platform spike.** The Free
plan's CPU limit is a risk to watch, not to pre-validate.

- Workers Free allows **10 ms of CPU per request**. Waiting on Vectorize or
  Workers AI does not count; routing, Zod validation, JSON serialization
  and our own logic do. Hono is small and built for Workers, so this
  budget is comfortable for this workload, and cold start is a few
  milliseconds.
- **Trigger:** error 1102 (CPU time exceeded) in `wrangler dev` or in the
  dashboard.
- **Mitigations:** simpler Zod schemas, avoid re-parsing large payloads.
- **No fallback platform.** The project runs only on Cloudflare Free. If a
  limit is hit (CPU, Neurons, Vectorize), the API surfaces the error
  (`1102`/`5xx`, `503` for exhausted allowance) and the limit is handled by
  fixing the code, not by changing infrastructure or plan.
- Keep `compatibility_date` current at deploy time; `nodejs_compat` is not
  needed unless a dependency requires it.

## Limits checked on 2026-11-13 (official documentation)

- **Vectorize (Workers Free):** 5 million stored dimensions and 30 million
  queried dimensions per month; up to 100 indexes.
- **Vectorize (general):** up to 1,536 dimensions per vector; ID up to 64
  bytes; up to 10 KiB metadata per vector; max `topK` of 50 with
  `returnMetadata: "all"`; up to 10 metadata indexes.
- **Workers AI (Free):** 10,000 Neurons per day.
- **Workers:** their own request and CPU limits.

Limits may change; check the official pages before deploying and watch the
usage dashboard. Exceeding free limits may cause failures or require a
plan change.
