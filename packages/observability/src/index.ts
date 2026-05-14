import { bootstrapLogger, createLogger, logger } from "./logger.js";
import { loggerMiddleware } from "./middlewares/logger.js";
import type { BootstrapOptions } from "./types.js";
import { getTraceId, initTracerIfLocal } from "./tracer.js";

export type { BootstrapOptions } from "./types.js";

export function bootstrap(options: BootstrapOptions): void {
  bootstrapLogger(options);
  initTracerIfLocal(options.service);
}

export { createLogger, getTraceId, logger, loggerMiddleware };
