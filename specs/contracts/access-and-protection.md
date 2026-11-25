# Access and protection

Since this is a microservice consumed by other systems:

- **Authentication:** `X-API-Key` header compared with a Worker *secret*
  (`wrangler secret put API_KEY`) using a **constant-time comparison**
  (`timingSafeEqual` from `hono/utils/buffer`, or `crypto.subtle` digests of
  both values compared in constant time). `/api/health`, `/docs` and
  `/openapi.json` stay open; `/api/chat` and `/api/search` require the
  key. Missing or wrong key → `401` with the standard error body
  ([errors](api-endpoints.md)). Declare the security scheme in OpenAPI so
  the "Authorize" button works in Swagger.
- **Order of checks** (cheapest and most protective first), implemented as
  Hono middleware registered in this order on `/api/chat` and
  `/api/search`: **1) authentication → 2) rate limit → 3) body validation
  (Zod) → 4) models.** Middleware runs before the validator, so the order
  holds as long as auth and rate limit are registered before the route. Unauthenticated requests must not consume the
  rate-limit budget of legitimate clients nor any Neurons.
- **Rate limiting:** protects the daily Neurons allowance. Because there is
  a single shared key, "per key" is meaningless: limit **per client IP**
  (`CF-Connecting-IP`) on `/api/chat` and `/api/search`, plus a **global**
  cap on both (they share the Neurons allowance; `/api/search` still spends
  embedding Neurons). Use the Workers
  Rate Limiting binding or a Cloudflare rate limiting rule (check what the
  Free plan offers). The binding is per-location and approximate: treat it
  as a brake, not as an exact quota. The hard daily limit is the Workers AI
  Neurons allowance (`503` when detectable).
- **CORS:** disabled by default; enable only for known origins if a
  front-end calls the API directly from the browser.
- **Secrets:** no keys in the repository. Ingestion token only in a local
  environment variable; `API_KEY` as a Worker secret.
- **Privacy:** user questions can be sensitive (faith, personal
  situations). Do not log question text, answers or the API key; log only
  status, latency, route and error class. Document this in the README.
