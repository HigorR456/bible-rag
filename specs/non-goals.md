# What not to build

Explicit project limits. If a request falls here, the default answer is
**no**, unless this spec is changed first.

## Out of scope for the first version

Most of these may come later, once the basic RAG pipeline is correct. The
exception is commentaries/denominational doctrine, which is a permanent
policy limit (neutrality), not a postponement:

| Do not build | Reason / note |
| --- | --- |
| Any web interface | Left to API consumers |
| User login and accounts | Only the service `X-API-Key` exists |
| Response streaming (SSE) | Outside the MVP |
| Persistent conversation history | The API is stateless |
| Multiple translations | One translation per index; each needs its own license |
| PDF upload | Single source: ONBV from eBible |
| Agents and tools | Outside the MVP |
| Fine-tuning | Outside the MVP |
| Reranking or hybrid search | Evaluate only after basic RAG works |
| Commentaries or denominational doctrine | Conflicts with the prompt's neutrality |

## Infrastructure and cost restrictions

| Do not build / use | Reason |
| --- | --- |
| Paid OpenAI API | First version uses only Workers AI |
| VM or dedicated server | Runs on Cloudflare Workers |
| Paid external vector database | Uses Vectorize |
| Public ingestion endpoint | Index loading is a local admin task |
| Node-only APIs (`fs`, `child_process`, ...) in `src/` | The Worker runs on the V8 runtime; use Web-standard APIs |
| In-memory mocked vector array as the "database" | Must be real Vectorize (mocks only in tests) |
| Blocking or CPU-heavy work in request handlers | 10 ms CPU limit on Free; everything is `async` |

## Data and AI restrictions

| Do not do | Reason |
| --- | --- |
| Mix translations in the same index | Different licenses and semantics |
| Cut a verse in half inside a chunk | Chunks contain whole verses only |
| Mix chapters or books in one chunk | Chunking rule |
| Truncate `bge-m3` embeddings | The model was not trained for it |
| Truncate or prefix differently between ingestion and query | Incompatible vectors |
| Call the LLM when `context_found` is `false` | Avoids invention; saves Neurons |
| Invent verses, references or quotes | Prompt rule |
| Present controversial interpretations as consensus | Prompt rule |
| Claim the answer is the only possible interpretation | Prompt rule |
| Present ONBV as a literal translation | It is dynamic equivalence |
| Present the AI answer as theological authority | Constitution |
| Write the copyright notice from memory | Copy it verbatim from the source |
| Treat verses missing in the source itself as errors | List and document them |

## Security

| Do not do | Reason |
| --- | --- |
| Commit keys or credentials | Ingestion token only in a local env var; `API_KEY` as a Worker secret |
| Enable CORS by default | Only for known origins, if needed |
| Leave `/api/chat` and `/api/search` without `X-API-Key` | Protects the Neurons allowance |
