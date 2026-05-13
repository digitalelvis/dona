import type { Context, ErrorHandler } from "hono";

import {
  isDomainErrorLike,
  mapDomainErrorToHttp,
  mapUnknownErrorToHttp,
  type HttpProblem,
} from "../error-mapper.js";
import type { HttpKitEnv } from "../types.js";

export interface ErrorHandlerOptions {
  /** Side-effect hook invoked for every error before the response is built. */
  readonly onError?: (err: unknown, c: Context<HttpKitEnv>) => void;
}

export type HonoErrorHandler = ErrorHandler<HttpKitEnv>;

/**
 * Builds a Hono `app.onError` handler that converts any thrown value into
 * the project's HttpProblem JSON shape.
 *
 * NOTE: In Hono v4 the route-handler error path is intercepted by the
 * app's `errorHandler` *before* upstream middleware catches can see it
 * (see Hono's `dist/compose.js`). The idiomatic Hono pattern is therefore
 * `app.onError(errorHandler({...}))` — which is what `createApp` does.
 */
export function errorHandler(options: ErrorHandlerOptions = {}): HonoErrorHandler {
  return (err, c) => {
    options.onError?.(err, c);
    const requestId = c.get("requestId");
    const problem: HttpProblem = isDomainErrorLike(err)
      ? mapDomainErrorToHttp(err, requestId)
      : mapUnknownErrorToHttp(err, requestId);

    c.status(problem.status as Parameters<typeof c.status>[0]);
    return c.json(problem.body);
  };
}
