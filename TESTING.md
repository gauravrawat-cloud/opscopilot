# Testing

This repository contains lightweight unit tests for both the API (Node/TypeScript)
and the Analyzer (Python). The goal is to validate core logic without requiring
Azure resources, Cosmos DB, or external APIs.

The test suite is intentionally small and fast.

---

## What is covered

### API Function App (Node / TypeScript)
- Request helpers (CORS, JSON response)
- API key validation
- Rate limiting (per route + method)
- In-memory repository logic

**Not covered (by design):**
- Azure Functions runtime
- HTTP routing / bindings
- Cosmos DB SDK internals

---

### Analyzer Function App (Python)
- Input sanitization and truncation
- Prompt / embedding text construction
- RAG context formatting

**Not covered (by design):**
- OpenAI API calls
- Cosmos DB calls
- Queue trigger wiring

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- Virtual environment activated for Python tests

---

## Running Analyzer tests (Python)

From the Analyzer function folder:

cd apps/analyzer-func
source .venv/bin/activate   # or equivalent
pip install -r requirements.txt
pytest

---

## Running API tests (Node)

From the API function folder:

cd apps/api-func
npm install
npm test

