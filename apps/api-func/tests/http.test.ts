import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { corsPreflight, json, rateLimit, requireApiKey, __resetRateLimitForTests } from "../src/shared/http";

// tiny request stub
function makeReq(opts?: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}) {
  const headersMap = new Map<string, string>();
  for (const [k, v] of Object.entries(opts?.headers ?? {})) {
    headersMap.set(k.toLowerCase(), v);
  }

  return {
    method: opts?.method ?? "GET",
    url: opts?.url ?? "http://localhost/api/items",
    headers: {
      get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
    },
  } as any;
}

describe("shared/http", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers(); // for rateLimit tests
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
    delete process.env.APP_API_KEY;
  });

  it("json() returns status + json content-type + CORS header", () => {
    const res = json(200, { ok: true });
    expect(res.status).toBe(200);
    expect(res.headers?.["content-type"]).toBe("application/json");
    expect(res.headers?.["access-control-allow-origin"]).toBe("*");
    expect(res.body).toBe(JSON.stringify({ ok: true }));
  });

  it("corsPreflight() returns 204 and allow headers/methods", () => {
    const res = corsPreflight("GET,POST,OPTIONS");
    expect(res.status).toBe(204);
    expect(res.headers?.["access-control-allow-origin"]).toBe("*");
    expect(res.headers?.["access-control-allow-methods"]).toBe("GET,POST,OPTIONS");
    expect(res.headers?.["access-control-allow-headers"]).toContain("x-api-key");
  });

  describe("requireApiKey()", () => {
    it("allows request when APP_API_KEY is not set", () => {
      delete process.env.APP_API_KEY;
      const req = makeReq({ headers: {} });
      expect(requireApiKey(req)).toBeNull();
    });

    it("returns 401 when APP_API_KEY is set but header missing", () => {
      process.env.APP_API_KEY = "secret";
      const req = makeReq({ headers: {} });
      const res = requireApiKey(req);
      expect(res?.status).toBe(401);
      expect(res?.body).toBe(JSON.stringify({ error: "Unauthorized" }));
    });

    it("allows request when x-api-key matches", () => {
      process.env.APP_API_KEY = "secret";
      const req = makeReq({ headers: { "x-api-key": "secret" } });
      expect(requireApiKey(req)).toBeNull();
    });
  });

  describe("rateLimit()", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetRateLimitForTests();
        process.env = { ...originalEnv };
      });
    
    afterEach(() => {
        __resetRateLimitForTests();
        vi.useRealTimers();
        process.env = originalEnv;
        delete process.env.APP_API_KEY;
      });
      
    it("allows up to limit within the window, then returns 429", () => {
      const req = makeReq({
        method: "POST",
        url: "http://localhost/api/items",
        headers: { "x-api-key": "k1" },
      });

      // limit=3
      expect(rateLimit(req, { limit: 3, windowMs: 60_000 })).toBeNull();
      expect(rateLimit(req, { limit: 3, windowMs: 60_000 })).toBeNull();
      expect(rateLimit(req, { limit: 3, windowMs: 60_000 })).toBeNull();

      const res = rateLimit(req, { limit: 3, windowMs: 60_000 });
      expect(res?.status).toBe(429);
      expect(res?.headers?.["retry-after"]).toBeTruthy();
    });

    it("uses route+method in bucket (GET should not block POST)", () => {
      const getReq = makeReq({
        method: "GET",
        url: "http://localhost/api/items",
        headers: { "x-api-key": "k1" },
      });
      const postReq = makeReq({
        method: "POST",
        url: "http://localhost/api/items",
        headers: { "x-api-key": "k1" },
      });

      // exhaust GET bucket (limit=2)
      expect(rateLimit(getReq, { limit: 2, windowMs: 60_000 })).toBeNull();
      expect(rateLimit(getReq, { limit: 2, windowMs: 60_000 })).toBeNull();
      expect(rateLimit(getReq, { limit: 2, windowMs: 60_000 })?.status).toBe(429);

      // POST should still be allowed because bucket key includes method
      expect(rateLimit(postReq, { limit: 2, windowMs: 60_000 })).toBeNull();
    });

    it("resets after windowMs elapses", () => {
      const req = makeReq({
        method: "POST",
        url: "http://localhost/api/items",
        headers: { "x-api-key": "k1" },
      });

      expect(rateLimit(req, { limit: 1, windowMs: 10_000 })).toBeNull();
      expect(rateLimit(req, { limit: 1, windowMs: 10_000 })?.status).toBe(429);

      // advance time past window
      vi.advanceTimersByTime(10_001);

      // should allow again
      expect(rateLimit(req, { limit: 1, windowMs: 10_000 })).toBeNull();
    });

    it("falls back to IP-based key when api key missing", () => {
      const req = makeReq({
        method: "POST",
        url: "http://localhost/api/items",
        headers: { "x-forwarded-for": "1.2.3.4" },
      });

      expect(rateLimit(req, { limit: 1, windowMs: 60_000 })).toBeNull();
      expect(rateLimit(req, { limit: 1, windowMs: 60_000 })?.status).toBe(429);
    });
  });
});
