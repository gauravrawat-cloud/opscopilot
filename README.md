# OpsCopilot

OpsCopilot is a small end-to-end demo project that mimics how modern ops/support platforms
use AI to analyze incidents and learn from past issues.

The goal of this project is not UI polish, but **architecture, clarity, and correctness**:
- Azure Functions (Node + Python)
- Cosmos DB (NoSQL + Vector Search)
- OpenAI (analysis + embeddings)
- Queue-based async processing
- Simple but realistic guardrails (auth, rate limiting)

This repo is structured like a real system, but kept intentionally lightweight so it can
be understood and run locally.

---

## What does OpsCopilot do?

1. A user creates an ops issue (title + description)
2. The API stores it and queues it for analysis
3. A Python analyzer:
   - analyzes the issue using OpenAI
   - retrieves similar past incidents using vector search (RAG)
   - produces a structured analysis
4. The analysis is saved back and shown in the UI

Over time, the system “learns” by reusing past incidents as context.

---

## High-level architecture
```
Web (React)
    |
    v
API (Node.js Azure Function)
    |
    |-- Cosmos DB (items)
    |-- Azure Queue
    |
    v
Analyzer (Python Azure Function)
    |
    |-- OpenAI (analysis + embeddings)
    |-- Cosmos DB (item_vectors)
```
Key idea:
- **Node API** = request handling, persistence, auth
- **Python analyzer** = AI + RAG logic
- **Cosmos DB** = both data store and vector index

---

## Tech stack

- Frontend: React + Vite
- API: Azure Functions (Node.js, TypeScript)
- Analyzer: Azure Functions (Python)
- Database: Cosmos DB (NoSQL + vector search)
- AI: OpenAI (chat + embeddings)
- Messaging: Azure Storage Queue

---

## Repo structure
```
/
├─ apps/
│ ├─ web/ # React UI
│ ├─ api-func/ # Node.js API (Azure Function)
│ └─ analyzer-func/ # Python analyzer (Azure Function)
└─ README.md
```
Each app has its own README with setup and runtime details.

---

## Running locally (high level)

You’ll typically run three things in parallel:
1. Web UI
2. Node API function
3. Python analyzer function

Each app README explains its own setup and environment variables.

---

## Key features worth noting

- API key protection on write endpoints
- Per-route rate limiting
- Async queue-based processing
- Vector similarity search using Cosmos DB
- Explainable AI (stores which past incidents were used)

---

## Configuration

This repo uses environment-based configuration.

- Example configuration files are provided:
  - `apps/api-func/local.settings.example.json`
  - `apps/analyzer-func/local.settings.example.json`
  - `apps/web/.env.example`

---

## Future improvements (out of scope for now)

- CI/CD pipelines
- APIM / gateway
- Authentication with Entra ID
- UI improvements
- Hybrid search (keyword + vector)
- Evaluation / scoring of AI output

```md
See [TESTING.md](./TESTING.md) for how to run unit tests.
