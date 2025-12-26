# API Function (Node.js)

This Azure Function provides the HTTP API for OpsCopilot.

It is responsible for:
- handling requests from the UI
- validating input
- enforcing auth and rate limits
- storing data in Cosmos DB
- enqueueing items for async analysis

The API intentionally contains **no AI logic**.

---

## Routes

### GET /api/items
Returns all items.

### POST /api/items
Creates a new item and queues it for analysis.

Protected by:
- x-api-key
- rate limiting

### POST /api/items/{id}/analysis
Stores analysis results returned by the analyzer.
Used only by the Python analyzer.

---

## Environment variables

Required:
- `AzureWebJobsStorage`
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DB_NAME`
- `COSMOS_ITEMS_CONTAINER`
- `APP_API_KEY`

Optional:
- `USE_COSMOS=true`
- `OPS_QUEUE_NAME`
- rate limit config values

---

## Local development

```bash
npm install
npm start
