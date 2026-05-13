import { NotFoundError } from "@donaoferta/core-kernel";
import { Hono } from "hono";

import { mapDomainErrorToHttp, type HttpProblem } from "./error-mapper.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { requestId } from "./middlewares/request-id.js";
import type { HttpKitEnv } from "./types.js";

export interface AppFactoryOptions {
  /** Generator for the per-request id when none is provided by the caller. */
  readonly requestId: () => string;
  /** Optional side-effect hook (logging, tracing) on every caught error. */
  readonly onError?: (err: unknown) => void;
}

export type HttpKitApp = Hono<HttpKitEnv>;

/**
 * Builds a Hono app pre-wired with:
 * - `app.onError(errorHandler(...))` for centralized DomainError → HTTP mapping;
 * - `app.notFound(...)` returning the HttpProblem shape with NOT_FOUND code;
 * - the `requestId` middleware (assigns/echoes X-Request-Id and stores it
 *   under `c.get("requestId")` so the error/notFound handlers can read it).
 *
 * Routes are registered by the caller AFTER `createApp` returns.
 */
export function createApp(options: AppFactoryOptions): HttpKitApp {
  const app = new Hono<HttpKitEnv>();

  app.use("*", requestId({ generate: options.requestId }));

  app.notFound((c) => {
    const notFound = new NotFoundError(`Route not found: ${c.req.method} ${c.req.path}`);
    const reqId = c.get("requestId");
    const problem: HttpProblem = mapDomainErrorToHttp(notFound, reqId);
    c.status(problem.status as Parameters<typeof c.status>[0]);
    return c.json(problem.body);
  });

  const onError = options.onError;
  app.onError(errorHandler(onError !== undefined ? { onError: (err) => onError(err) } : {}));

  return app;
}
