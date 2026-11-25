# API documentation (Swagger)

`@hono/zod-openapi` generates the OpenAPI document at `/openapi.json` from
the route definitions, and `@hono/swagger-ui` serves Swagger UI at `/docs`,
which replaces a UI in this project. To make it real documentation:

- Fill in `info.title`, `info.version` and `info.description` through
  `app.doc("/openapi.json", {...})`. The `description` must explain what the
  API does, that answers are AI generated, and include **the ONBV
  attribution notice and the CC BY-SA 4.0 license link**.
- Use `tags` (`chat`, `search`, `health`), `summary` and `description` on
  each `createRoute(...)`, and declare the `responses` schema on all of
  them.
- Include examples in the schemas (`.openapi({ example: ... })`) with real
  Portuguese questions.
- Document error codes (`401`, `422`, `429`, `500`, `502`, `503`, `504`) in
  `responses`, using the single `{"detail": "<string>"}` schema
  ([errors](api-endpoints.md)). Declare the `422` response explicitly so
  the documentation matches the real body (the generated default would
  describe the Zod error shape).
- Register `X-API-Key` with
  `app.openAPIRegistry.registerComponent("securitySchemes", "ApiKey",
  { type: "apiKey", in: "header", name: "X-API-Key" })` and reference it via
  `security` on the protected routes. Auth is a middleware that throws our
  own `401`, so the status and body follow the contract.
- **`/docs` visibility (decision):** public by default. An environment
  variable may disable `/docs` only; `/openapi.json` always stays public so
  the attribution notice remains in the OpenAPI document (acceptance
  criterion). Attribution also travels in every response body. There is no
  `/redoc` (no first-party Hono ReDoc integration; Swagger UI is enough).

Swagger UI loads its CSS/JS from a CDN in the browser of whoever opens the
page; this adds no load to the Worker.
