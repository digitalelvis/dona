import { describe, expect, it } from "vitest";

import { compose } from "../src/compose.js";

describe("apps/api HTTP", () => {
  it("GET /health returns 200 with ok status, version, and uptimeSeconds", async () => {
    const fixedClock = {
      now: () => new Date("2020-01-01T00:00:00.000Z"),
      nowEpochMs: () => 1_577_836_800_000,
    };
    const { app } = compose({
      clock: fixedClock,
      requestId: () => "req-health-1",
      uptimeSeconds: () => 42,
    });

    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBe("req-health-1");
    const body = (await res.json()) as {
      status: string;
      uptimeSeconds: number;
      version: string;
      traceId: string | null;
    };
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0");
    expect(body.uptimeSeconds).toBe(42);
    expect(body.traceId).toBeNull();
  });

  it("GET /health includes version field for contract stability", async () => {
    const { app } = compose({ requestId: () => "req-version", uptimeSeconds: () => 0 });
    const res = await app.request("/health");
    const body = (await res.json()) as { version: string };
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("GET / redirects to /health", async () => {
    const { app } = compose({ requestId: () => "req-root" });
    const res = await app.request("/", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/health");
    expect(res.headers.get("X-Request-Id")).toBe("req-root");
  });

  it("unknown route returns 404 NOT_FOUND with requestId", async () => {
    const { app } = compose({ requestId: () => "req-404" });

    const res = await app.request("/anything-else");
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Request-Id")).toBe("req-404");
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBe("req-404");
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});
