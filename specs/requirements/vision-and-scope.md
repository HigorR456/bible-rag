# Vision and scope

**Goal:** build a **backend microservice** (HTTP API) for question
answering about the Bible in Portuguese, using RAG (Retrieval-Augmented
Generation), written in **TypeScript with Hono**, hosted on Cloudflare and
prioritizing free-tier services.

**Scope:** the API only. There is no web interface; documentation and
manual testing use the Swagger UI generated from the OpenAPI document (`/docs`).
Consumers (front-ends, bots, other services) live outside this repository.

See limits in [../non-goals.md](../non-goals.md).

## Functional requirements

Users can ask questions such as:

- "Which passages talk about forgiveness?"
- "What does Jesus teach about loving your neighbor?"
- "Which verses relate to anxiety?"
- "Explain John 3:16 using other passages as context."

Requirements:

- **FR-grounding:** answer based on the retrieved passages.
- **FR-references:** return the Bible references of the sources used.
- **FR-no-context:** state clearly when there is not enough context.
- **FR-disclaimer:** treat the AI answer as assisted explanation, not a
  translation or theological authority.
- **FR-search:** offer semantic search without an LLM (`/api/search`).
