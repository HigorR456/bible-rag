# API endpoints and contract

| Method | Route           | Function                                            |
| ------ | --------------- | --------------------------------------------------- |
| `POST` | `/api/chat`     | Answer a question with RAG (search + LLM)           |
| `POST` | `/api/search`   | Semantic search only: returns passages, no LLM      |
| `GET`  | `/api/health`   | Check that the API is up                            |
| `GET`  | `/docs`         | Swagger UI (`@hono/swagger-ui`)                     |
| `GET`  | `/openapi.json` | OpenAPI specification (generated from the Zod schemas) |

`/api/search` is cheap (no LLM Neurons, but it still spends embedding
Neurons) and is useful for debugging retrieval and for consumers who only
want passages.

There is no public ingestion endpoint (see [non-goals](../non-goals.md)).

## Zod schemas

Defined in `src/schemas.ts` with `z` from `@hono/zod-openapi`; TypeScript
types come from `z.infer`.

```ts
const Testament = z.enum(["AT", "NT"]);

const SearchRequest = z.object({
  question: z.string().trim().min(3).max(500),   // trim runs before length checks
  top_k: z.number().int().min(1).max(8).default(6),
  book: z.enum(BOOK_CODES).optional(),           // USFM code, e.g. "JHN" (enum shows in OpenAPI)
  testament: Testament.optional(),
});

const ChatRequest = SearchRequest;               // same fields; separate name for OpenAPI docs

const Source = z.object({
  id: z.string(),          // passage id, e.g. "MAT_6_14-15" or "JHN_3_16"
  reference: z.string(),   // "Mateus 6:14-15"
  text: z.string(),
  score: z.number(),       // cosine similarity from Vectorize (higher = closer)
});

const Attribution = z.object({
  title: z.string(),
  notice: z.string(),
  license: z.string(),
  license_url: z.string(),
  source: z.string(),
  changes: z.string(),     // visible statement of text alterations (CC BY-SA)
});

const ChatResponse = z.object({
  answer: z.string(),
  context_found: z.boolean(),
  translation: z.literal("ONBV"),
  sources: z.array(Source),
  attribution: Attribution,
  disclaimer: z.string(),
});

const SearchResponse = ChatResponse.omit({ answer: true, disclaimer: true });
```

- `book` must be a valid USFM code from the book table; an unknown code is a
  `422`. Filters map to Vectorize metadata filters
  ([data model](../design/data-model.md)).
- `sources` has at most `top_k` items, **after** the similarity threshold
  and adjacent-chunk merge ([query flow](../flows/query.md)). Order: the
  passage for an explicit reference in the question (if any) comes first,
  regardless of its score; the rest are ordered by score, highest first.
  It contains exactly the passages sent to the LLM (for `/api/chat`).
- **Passage `id`:** for an unmerged chunk it is the chunk id. For merged
  adjacent chunks it is the id of the merged range in the same format
  (`BOOK_CHAPTER_START-END`, or `BOOK_CHAPTER_VERSE` for one verse), so it
  may not match a vector id; consumers treat it as an opaque passage id.
  The `score` of a merged passage is the maximum of its chunks.

## Example

Request:

```json
{
  "question": "O que a Bíblia diz sobre perdão?",
  "top_k": 6
}
```

Response:

```json
{
  "answer": "As passagens recuperadas apresentam o perdão como...",
  "context_found": true,
  "translation": "ONBV",
  "sources": [
    {
      "id": "MAT_6_14-15",
      "reference": "Mateus 6:14-15",
      "text": "...",
      "score": 0.82
    },
    {
      "id": "EPH_4_29-32",
      "reference": "Efésios 4:29-32",
      "text": "...",
      "score": 0.79
    }
  ],
  "attribution": {
    "title": "Biblica® Open Nova Bíblia Viva 2007",
    "notice": "<copyright notice copied from ATTRIBUTION.md>",
    "license": "CC BY-SA 4.0",
    "license_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br",
    "source": "https://ebible.org/bible/details.php?id=poronbv",
    "changes": "<changes statement copied from ATTRIBUTION.md>"
  },
  "disclaimer": "Resposta gerada por IA; pode conter erros e não substitui a leitura do texto bíblico."
}
```

`context_found` is `false` when no passage clears a minimum similarity
threshold (calibrate during evaluation). The same threshold applies to
`/api/search` and `/api/chat`. In that case `sources` is empty; for
`/api/chat` the answer says there is not enough context and the LLM is
**not called**. The `attribution` block is returned anyway (the response
schema is fixed), even though no Bible text is included.

## Errors

Single format `{"detail": "<string>"}` for **every** error, including
validation errors. `@hono/zod-openapi` does not produce this shape by
default (a failed validation returns the Zod error object), so the app sets
a `defaultHook` on `OpenAPIHono` (validation failures), `app.onError`
(`HTTPException` and unhandled exceptions) and `app.notFound` that flatten
every error to a string, e.g. `"question: too short (min 3 characters)"`
(messages are built by us, not copied from Zod, so they stay stable across
Zod versions). Error bodies never include Bible text, the API key, or the
user's question.

| Status | Meaning |
| ------ | ------- |
| `401` | Missing or invalid `X-API-Key` (same status for both, to avoid revealing which) |
| `404` | Unknown route (standard error body) |
| `405` | Method not allowed on a known route |
| `413` | Request body larger than the limit (`bodyLimit`, 4 KiB) |
| `422` | Invalid input (length, `top_k` range, unknown `book`/`testament`) |
| `429` | Rate limit (include `Retry-After` when available) |
| `500` | Unexpected internal error (generic message) |
| `502` | Workers AI or Vectorize failure |
| `503` | Allowance exhausted (when detectable: Workers AI daily Neurons) |
| `504` | Workers AI or Vectorize timeout |

## Generation model

Choose among Workers AI text models with good Portuguese performance,
considering Neuron cost per answer. Document the chosen model in the
README.

Capacity planning: the real ceiling of `/api/chat` on Free is the
**10,000 Neurons/day** allowance (shared by question embeddings, `/api/search`
and generation), not the Vectorize query budget. Measure Neurons per
answer during evaluation and record the resulting daily request estimate in
the README ([implementation plan](../tasks/implementation-plan.md), S10c).
