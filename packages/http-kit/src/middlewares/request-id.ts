import type { MiddlewareHandler } from "hono";

import type { HttpKitEnv } from "../types.js";

const HEADER_NAME = "X-Request-Id";

export interface RequestIdOptions {
  /** Generator invoked when the inbound request does not carry an X-Request-Id header. */
  generate: () => string;
}

/**
 * Hono middleware that ensures every request has a stable identifier:
 * - reads `X-Request-Id` from the inbound request if present;
 * - otherwise calls `options.generate()`;
 * - stores it under `c.set("requestId", ...)` for downstream handlers and
 *   echoes it on the response `X-Request-Id` header.
 */
export function requestId(options: RequestIdOptions): MiddlewareHandler<HttpKitEnv> {
  return async (c, next) => {
    const inbound = c.req.header(HEADER_NAME);
    const id = inbound && inbound.length > 0 ? inbound : options.generate();
    c.set("requestId", id);
    c.header(HEADER_NAME, id);
    await next();
  };
}
