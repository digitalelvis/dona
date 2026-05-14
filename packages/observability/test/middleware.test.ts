import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { Hono } from "hono";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { pino } from "pino";

import { loggerMiddleware } from "../src/middlewares/logger.js";

function captureLogger(): { log: ReturnType<typeof pino>; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const log = pino(stream);
  return { log, lines };
}

describe("loggerMiddleware", () => {
  afterEach(() => {
    delete process.env.LAMBDA_TASK_ROOT;
  });

  it("logs method, path, statusCode, and durationMs", async () => {
    const { log, lines } = captureLogger();
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("requestId", "rid-1");
      await next();
    });
    app.use("*", loggerMiddleware(log));
    app.get("/ping", (c) => c.json({ ok: true }));

    const res = await app.request("/ping");
    expect(res.status).toBe(200);
    expect(lines.length).toBe(1);
    const row = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(row.method).toBe("GET");
    expect(row.path).toBe("/ping");
    expect(row.statusCode).toBe(200);
    expect(row.durationMs).toBeTypeOf("number");
    expect(row.msg).toBe("request");
  });

  it("includes requestId from context", async () => {
    const { log, lines } = captureLogger();
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("requestId", "req-abc");
      await next();
    });
    app.use("*", loggerMiddleware(log));
    app.get("/", (c) => c.text("ok"));

    await app.request("/");
    const row = JSON.parse(lines[0] ?? "{}") as { requestId?: string };
    expect(row.requestId).toBe("req-abc");
  });

  it("includes traceId when an OpenTelemetry span is active", async () => {
    const { log, lines } = captureLogger();
    context.setGlobalContextManager(new AsyncLocalStorageContextManager());
    const provider = new BasicTracerProvider();
    provider.register();
    const tracer = trace.getTracer("mw-test");
    const span = tracer.startSpan("request");

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("requestId", "r1");
      await next();
    });
    app.use("*", loggerMiddleware(log));
    app.get("/t", (c) => c.text("ok"));

    await context.with(trace.setSpan(context.active(), span), async () => {
      await app.request("/t");
    });
    span.end();
    await provider.shutdown();

    const row = JSON.parse(lines[0] ?? "{}") as { traceId?: string };
    expect(row.traceId).toMatch(/^1-[0-9a-f]{8}-[0-9a-f]{24}$/);
  });

  it("omits traceId field when no span is active", async () => {
    const { log, lines } = captureLogger();
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("requestId", "r228");
      await next();
    });
    app.use("*", loggerMiddleware(log));
    app.get("/no-trace", (c) => c.text("ok"));

    await app.request("/no-trace");
    const row = JSON.parse(lines[0] ?? "{}") as { traceId?: string };
    expect(row.traceId).toBeUndefined();
  });
});
