import { HttpRequest, HttpResponseInit } from "@azure/functions";

export function json(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}

export function corsPreflight(allowMethods: string): HttpResponseInit {
  return {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": allowMethods,
      "access-control-allow-headers": "content-type,x-api-key",
    },
  };
}

export function requireApiKey(request: HttpRequest): HttpResponseInit | null {
  const expected = process.env["APP_API_KEY"];
  if (!expected) return null; // allow if not configured

  const provided = request.headers.get("x-api-key") || request.headers.get("X-API-Key");
  if (!provided || provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }
  return null;
}

type RateState = { count: number; resetAtMs: number };
const rateMap = new Map<string, RateState>();

// cleanup so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateMap.entries()) {
    if (now >= v.resetAtMs) rateMap.delete(k);
  }
}, 60_000).unref?.();

export function rateLimit(
  request: HttpRequest,
  opts?: { limit?: number; windowMs?: number }
): HttpResponseInit | null {
  const limit = opts?.limit ?? 30;
  const windowMs = opts?.windowMs ?? 60_000;

  const apiKey = request.headers.get("x-api-key") || request.headers.get("X-API-Key");
  const fallback =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-client-ip") ||
    "unknown";

  const u = new URL(request.url);
  const path = u.pathname; 
  const method = request.method || "UNKNOWN";
  const idBase = apiKey ? `key:${apiKey}` : `ip:${fallback}`;
  const id = `${idBase}:${method}:${path}`;

  const now = Date.now();
  const existing = rateMap.get(id);

  if (!existing || now >= existing.resetAtMs) {
    rateMap.set(id, { count: 1, resetAtMs: now + windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count <= limit) return null;

  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
  return {
    status: 429,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "retry-after": String(retryAfterSec),
    },
    body: JSON.stringify({ error: "Too Many Requests", limit, windowMs, retryAfterSec }),
  };
}

// test-only helper (clears in-memory limiter)
export function __resetRateLimitForTests() {
  rateMap.clear();
}