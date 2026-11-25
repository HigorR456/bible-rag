# Architecture

```text
                    INGESTION PHASE (once, or when updating)
   ONBV file (USFM/USFX/VPL from eBible)
                  |
                  v
       Chunking script  (ALREADY IMPLEMENTED)
       - whole verses, max 5 per chunk
       - max 120 words per chunk
       - never mixes chapters or books
                  |
                  v
       chunks_onbv.jsonl
                  |
                  v
       Local ingestion script (ingest.ts)
       - validates coverage and duplicates
       - generates embeddings (Workers AI)
       - upserts into Vectorize (vector + metadata + text)


                              QUERY PHASE
   HTTP client (other service, curl, Swagger UI)
      |
      v
   Cloudflare Worker  ->  Hono (TypeScript)
      |
      +----> Workers AI: question embedding
      |                  |
      |                  v
      |             Vectorize: semantic search
      |                  |
      |                  v
      |             chunks + references (via metadata)
      |
      +----> Workers AI: LLM receives question + context
                         |
                         v
                 JSON: answer + sources + attribution
```

Details: [ingestion](../flows/ingestion.md) · [query](../flows/query.md) ·
[platform](cloudflare-platform.md).
