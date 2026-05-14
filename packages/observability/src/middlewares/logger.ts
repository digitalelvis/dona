import type { Logger } from "pino";
import type { MiddlewareHandler } from "hono";

import { getTraceId } from "../tracer.js";

export function loggerMiddleware(log: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const requestId = c.get("requestId") as string | undefined;
    const traceId = getTraceId();
    log.info(
      {
        requestId,
        traceId: traceId ?? undefined,
        method: c.req.method,
        path: c.req.path,
        statusCode: c.res.status,
        durationMs: Date.now() - start,
      },
      "request",
    );
  };
}
