# Dimension budget (critical decision)

The Free plan's limit of **5 million stored dimensions** is the project's
main bottleneck.

```text
stored dimensions = chunk count × embedding dimension          (≤ 5,000,000)
queried dimensions/month = (queries + chunk count) × dimension (≤ 30,000,000)
```

| Vector dimension | Max chunks (5M) |
| ---------------- | --------------- |
| 1024             | 4,882           |
| 768              | 6,510           |
| 512              | 9,765           |
| 384              | 13,020          |
| 256              | 19,531          |

The Bible has about 31 thousand verses. With the current chunking (max 5
verses and max 120 words per chunk), the measured total is **8,102 chunks**
(`wc -l chunks_onbv.jsonl`; verified 2026-11-18). Re-measure if the chunking
rules change:

```bash
wc -l chunks_onbv.jsonl
```

At 8,102 chunks: 1024 and 768 dimensions do not fit; **512 fits**
(8,102 × 512 ≈ 4.15 M stored dimensions, ~17% headroom). The budget is
**account-wide**: a second index (e.g. during re-ingestion) counts against
the same 5 M.

## Embedding model choice (multilingual, required for Portuguese)

| Option | Workers AI model | Dimension | Note |
| ------ | ---------------- | --------- | ---- |
| A (recommended) | `@cf/google/embeddinggemma-300m` | 768, truncatable to 512/256 | Multilingual; Matryoshka-trained, allows truncating and renormalizing. Beta. |
| B | `@cf/baai/bge-m3` | 1024 (fixed) | Multilingual and robust, but fits Free only with ≤ 4,882 chunks. Do not truncate. |

## Decision rule

- If chunk count ≤ 4,882 → bge-m3 (1024) is viable.
- If chunk count ≤ 9,765 → embeddinggemma truncated to **512**.
- Above that → embeddinggemma truncated to 384/256, **or** revisit
  chunking.

Current decision: 8,102 chunks → embeddinggemma truncated to **512**
→ ~4.15 M stored dimensions and budget for ~50 thousand Vectorize queries
per month ((30,000,000 / 512) − 8,102 ≈ 50,491). This is the Vectorize
ceiling only, and it assumes one Vectorize query per request: a question
with an explicit reference runs a second query (reference lookup), so the
real number of such requests is lower; the practical ceiling for `/api/chat` is the Workers AI
10,000 Neurons/day allowance (see
[api-endpoints](../contracts/api-endpoints.md#generation-model)).
EmbeddingGemma is in Beta: if it is withdrawn or changed, the whole index
must be re-embedded (new index, see
[ingestion](../flows/ingestion.md#re-ingestion-and-index-versioning)); bge-m3
is not a drop-in fallback because it does not fit this budget.

## Truncation and prefixes

- **Truncating:** take the first N dimensions and apply L2 normalization,
  **exactly the same way** at ingestion and query time. Index uses the
  `cosine` metric and the final chosen dimension.
- **EmbeddingGemma prefixes:** the model was trained with task prefixes
  (query vs. document). Test whether they improve search and, if used,
  always apply the same ones at ingestion and query time. **This decision
  blocks S05 (ingestion)**: record it in `config.ts` and the README before
  creating vectors.
- Document in the README: model, final dimension, truncation, metric, chunk
  count and prefixes.
