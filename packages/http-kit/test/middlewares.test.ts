import { NotFoundError, ValidationError } from "@donaoferta/core-kernel";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app-factory.js";
import { errorHandler } from "../src/middlewares/error-handler.js";
import { requestId } from "../src/middlewares/request-id.js";

describe("requestId middleware", () => {
  it("injects a generated id when the request does not carry one", async () => {
    const app = new Hono();
    app.use("*", requestId({ generate: () => "generated-id" }));
    app.get("/", (c) => c.text(c.get("requestId") as string));

    const res = await app.request("/");
    expect(await res.text()).toBe("generated-id");
    expect(res.headers.get("X-Request-Id")).toBe("generated-id");
  });

  it("reuses an inbound X-Request-Id header when present", async () => {
    const app = new Hono();
    app.use("*", requestId({ generate: () => "generated" }));
    app.get("/", (c) => c.text(c.get("requestId") as string));

    const res = await app.request("/", { headers: { "X-Request-Id": "inbound-id" } });
    expect(await res.text()).toBe("inbound-id");
    expect(res.headers.get("X-Request-Id")).toBe("inbound-id");
  });
});

describe("errorHandler (registered via app.onError)", () => {
  it("converts a thrown DomainError into the project's HttpProblem JSON", async () => {
    const app = new Hono();
    app.use("*", requestId({ generate: () => "rid-1" }));
    app.onError(errorHandler());
    app.get("/boom", () => {
      throw new ValidationError("bad shape");
    });

    const res = await app.request("/boom");
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("bad shape");
    expect(body.error.requestId).toBe("rid-1");
  });

  it("converts a non-Error throwable into a sanitized 500", async () => {
    const app = new Hono();
    app.onError(errorHandler());
    app.get("/raw", () => {
      throw new Error("internal-detail");
    });

    const res = await app.request("/raw");
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal server error");
  });

  it("invokes the onError hook for side effects (logging, tracing)", async () => {
    const seen: unknown[] = [];
    const app = new Hono();
    app.onError(errorHandler({ onError: (err) => seen.push(err) }));
    app.get("/x", () => {
      throw new NotFoundError("nope");
    });

    await app.request("/x");
    expect(seen).toHaveLength(1);
    expect((seen[0] as Error).name).toBe("NotFoundError");
    expect((seen[0] as { code: string }).code).toBe("NOT_FOUND");
  });
});

describe("createApp", () => {
  it("returns a Hono instance that emits NOT_FOUND for unmatched routes", async () => {
    const app = createApp({ requestId: () => "rid-42" });

    const res = await app.request("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Request-Id")).toBe("rid-42");
    const body = (await res.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBe("rid-42");
  });

  it("wires the requestId middleware so handlers can read c.get('requestId')", async () => {
    const app = createApp({ requestId: () => "rid-7" });
    app.get("/ping", (c) => c.json({ rid: c.get("requestId") }));

    const res = await app.request("/ping");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rid: string };
    expect(body.rid).toBe("rid-7");
    expect(res.headers.get("X-Request-Id")).toBe("rid-7");
  });
});
