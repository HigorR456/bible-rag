# MVP acceptance criteria

- [ ] The Hono (TypeScript) API is published on Cloudflare Workers.
- [ ] Swagger (`/docs`) lists all endpoints with examples, error codes and
  authentication.
- [ ] The ONBV translation, its source and the CC BY-SA 4.0 license are
  documented in `ATTRIBUTION.md`.
- [ ] Every response with Bible text includes the `attribution` block, and
  the OpenAPI description carries the attribution notice.
- [ ] `/api/chat` and `/api/search` require `X-API-Key`; a rate limit
  exists.
- [ ] Tests (Vitest) pass with fake services/`env`.
- [ ] Every error (including validation) returns `{"detail": "<string>"}`
  with the documented status; missing/invalid key → `401`.
- [ ] The attribution constant in `attribution.ts` (`notice` and `changes`)
  matches the marked section of `ATTRIBUTION.md` (checked by a test).
- [ ] Every source verse is in exactly one chunk; there are no duplicates
  in the index, and the index vector count equals the number of chunks.
- [ ] A question with an explicit reference (e.g. "João 3:16") includes
  the chunk that contains that verse.
- [ ] The evaluation records Neurons per answer and the resulting daily
  capacity of `/api/chat`.
- [ ] Chunk count × dimension fits in 5 M stored dimensions (or a plan
  change was decided and documented).
- [ ] Search returns correct Bible references with Portuguese book names. (FR-search)
- [ ] The answer presents the retrieved sources. (FR-references)
- [ ] When there is not enough context, the system admits it. (FR-no-context)
- [ ] The app uses Workers AI for embeddings and generation, with the same
  model/dimension at ingestion and query time.
- [ ] The app uses Vectorize as a real vector database — not an in-memory
  mocked array.
- [ ] Answers rely only on retrieved passages and carry the disclaimer.
  (FR-grounding, FR-disclaimer)
- [ ] CORS is disabled by default; logs contain no question text, answers
  or API key.
- [ ] The evaluation includes injection and sensitive-topic questions with
  the expected behavior from the prompt rules.
- [ ] Workers AI/Vectorize failures map to `502`, timeouts to `504`, an
  exhausted allowance to `503`; unknown routes return `404` with the
  standard body.
- [ ] Usage can be monitored in the Cloudflare dashboard.
- [ ] No key or credential is in the repository; the ingestion token lives
  only in a local environment variable and `API_KEY` as a Worker secret.
