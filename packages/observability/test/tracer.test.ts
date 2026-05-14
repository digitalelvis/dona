import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { afterEach, describe, expect, it } from "vitest";

import { getTraceId, initTracerIfLocal } from "../src/tracer.js";

describe("tracer", () => {
  afterEach(() => {
    delete process.env.LAMBDA_TASK_ROOT;
  });

  it("returns undefined when no span is active", () => {
    expect(getTraceId()).toBeUndefined();
  });

  it("returns X-Ray-style id when a span is active", async () => {
    context.setGlobalContextManager(new AsyncLocalStorageContextManager());
    const provider = new BasicTracerProvider();
    provider.register();
    const tracer = trace.getTracer("test");
    const span = tracer.startSpan("op");
    let id: string | undefined;
    context.with(trace.setSpan(context.active(), span), () => {
      id = getTraceId();
    });
    span.end();
    expect(id).toMatch(/^1-[0-9a-f]{8}-[0-9a-f]{24}$/);
    await provider.shutdown();
  });

  it("initTracerIfLocal skips when LAMBDA_TASK_ROOT is set", () => {
    process.env.LAMBDA_TASK_ROOT = "/var/task";
    initTracerIfLocal("api");
    expect(getTraceId()).toBeUndefined();
  });
});
