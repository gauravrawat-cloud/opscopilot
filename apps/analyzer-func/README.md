
---

# 📗 Analyzer README (`apps/analyzer-func/README.md`)

```md
# Analyzer Function (Python)

This Azure Function performs the AI analysis for OpsCopilot.

It is triggered asynchronously from a queue and handles:
- OpenAI chat-based analysis
- Embedding generation
- Vector similarity search (RAG)
- Posting results back to the API

---

## Responsibilities

For each queued item:
1. Generate an embedding for the issue text
2. Store/update the vector in Cosmos DB
3. Retrieve similar past incidents (same system only)
4. Call OpenAI with retrieved context (RAG)
5. Post structured analysis back to the API

---

## Environment variables

Required:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EMBED_MODEL`
- `OPENAI_MAX_OUTPUT_TOKENS`
- `OPENAI_MAX_INPUT_CHARS`
- `OPENAI_TIMEOUT_SECONDS`
- `OPENAI_TEMPERATURE`
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DB_NAME`
- `COSMOS_ITEMS_CONTAINER`
- `COSMOS_VECTORS_CONTAINER`
- `API_BASE_URL`
- `APP_API_KEY`

Optional:
- `RAG_TOP_K` (default: 3)

---

## Vector search design

- Vectors are stored in a separate `item_vectors` container
- Partitioned by system (`pk`)
- Cosine similarity
- DiskANN index
- 1536-dim OpenAI embeddings

Only items from the same system are considered for retrieval.

---

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
func start
