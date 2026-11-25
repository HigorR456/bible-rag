# Bible RAG — Specifications (SDD)

A backend microservice (HTTP API) for question answering over the Bible in
Portuguese, using RAG, built with **TypeScript + Hono** and hosted on
Cloudflare (free tier). These specs are the source of truth: code follows
what is written here, and behavior changes start by changing the spec.

## Spec-driven flow

- **Constitution** — non-negotiable principles.
- **Requirements** — what and why (scope, license, acceptance criteria).
- **Design** — how (architecture, platform, data, chunking).
- **Contracts** — interfaces (API, prompt, access, Swagger).
- **Flows** — step-by-step behavior (ingestion, query).
- **Tasks** — ordered implementation plan.
- **Non-goals** — explicit limits on what not to build.

## Index

| File | Content |
| --- | --- |
| [constitution.md](constitution.md) | Project principles |
| [non-goals.md](non-goals.md) | **What not to build** |
| [requirements/vision-and-scope.md](requirements/vision-and-scope.md) | Functional goal and scope |
| [requirements/translation-and-license.md](requirements/translation-and-license.md) | ONBV and CC BY-SA 4.0 obligations |
| [requirements/acceptance-criteria.md](requirements/acceptance-criteria.md) | MVP acceptance criteria |
| [design/architecture.md](design/architecture.md) | Overview and diagram |
| [design/cloudflare-platform.md](design/cloudflare-platform.md) | Services, Hono on Workers, limits |
| [design/dimension-budget.md](design/dimension-budget.md) | Embedding model choice |
| [design/data-model.md](design/data-model.md) | Chunks, book table, metadata |
| [design/chunking.md](design/chunking.md) | Chunking strategy |
| [design/repository-structure.md](design/repository-structure.md) | Repository layout |
| [contracts/api-endpoints.md](contracts/api-endpoints.md) | Endpoints, Zod schemas, errors |
| [contracts/access-and-protection.md](contracts/access-and-protection.md) | Auth, rate limiting, CORS |
| [contracts/swagger.md](contracts/swagger.md) | OpenAPI documentation |
| [contracts/prompt.md](contracts/prompt.md) | LLM prompt rules |
| [flows/ingestion.md](flows/ingestion.md) | Ingestion flow |
| [flows/query.md](flows/query.md) | Question flow |
| [tasks/implementation-plan.md](tasks/implementation-plan.md) | Implementation steps |
| [references.md](references.md) | Official links |
