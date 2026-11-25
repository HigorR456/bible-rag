# Project constitution

Principles that apply to every decision.

- **API only.** The product is an HTTP microservice. No web UI; Swagger UI
  (`/docs`) is the documentation and manual testing surface.
- **Free tier first.** Prefer Cloudflare services with a free allowance.
  "Free" means usage within current allowances, not a permanent guarantee.
- **Grounded in the text.** Answers rely exclusively on retrieved passages.
  Without enough context, the API says so instead of inventing.
- **AI is not a theological authority.** The answer is assisted
  explanation, not translation or doctrine.
- **Attribution travels with the text.** Every response containing Bible
  text carries the `attribution` block (CC BY-SA 4.0 / Biblica).
- **One translation per index.** ONBV is the only translation; any other
  would need a separate index and a verified license.
- **Same vectors at ingestion and query time.** Same model, dimension,
  truncation, normalization and prefixes.
- **Testable core.** Code in `src/` does not depend on the Cloudflare
  runtime outside `index.ts` and `env.ts`; tests run locally with fake
  services behind narrow interfaces.
- **No secrets in the repository.**
- **Validate before building.** Measure the chunk count before fixing
  decisions that depend on real limits. The platform spike was skipped
  (2026-11-18); the Free-plan CPU limit is a watched risk with no fallback
  platform (limits surface as errors); see
  [platform](design/cloudflare-platform.md).
- **Stack.** TypeScript + Hono for the app. The one-off chunking script is
  Python and runs outside the app.
