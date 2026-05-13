import { systemClock, uuidv4IdGenerator, type Clock } from "@donaoferta/core-kernel";

import { registerHealth } from "./handlers/health.js";
import { createApiApp, type ApiApp } from "./http/app.js";
import { APP_VERSION } from "./version.js";

export interface ComposeOptions {
  readonly clock?: Clock;
  readonly requestId?: () => string;
  readonly uptimeSeconds?: () => number;
}

export function compose(options: ComposeOptions = {}): { app: ApiApp } {
  const clock = options.clock ?? systemClock;
  const requestId = options.requestId ?? (() => uuidv4IdGenerator.newId());
  const app = createApiApp(requestId);
  registerHealth(app, {
    clock,
    version: APP_VERSION,
    ...(options.uptimeSeconds !== undefined ? { uptimeSeconds: options.uptimeSeconds } : {}),
  });
  return { app };
}
