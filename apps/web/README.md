
---

# 📙 Web README (`apps/web/README.md`)

```md
# Web App (React)

This is a simple React UI for interacting with OpsCopilot.

It allows users to:
- create new ops items
- view existing items
- see AI-generated analysis results

The UI is intentionally minimal.

---

## Tech stack

- React
- Vite
- Fetch API

---

## Proxy setup

During local development, the UI proxies API requests to:
http://localhost:7071

This avoids CORS issues and keeps the UI simple.

---

## Notes 

- No auth logic is implemented in the UI
- API key is sent via headers for demo purposes
- Styling is intentionally basic

---

## Local development

```bash
npm install
npm run dev

Runs on:
http://localhost:5173
