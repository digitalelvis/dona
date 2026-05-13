import type { Clock } from "@donaoferta/core-kernel";
import type { ApiApp } from "../http/app.js";

export interface RegisterHealthOptions {
  readonly clock: Clock;
  readonly version: string;
  /** Defaults to `Math.floor(process.uptime())`. */
  readonly uptimeSeconds?: () => number;
}

export function registerHealth(app: ApiApp, options: RegisterHealthOptions): void {
  const uptimeSeconds = options.uptimeSeconds ?? (() => Math.floor(process.uptime()));

  app.get("/health", (c) => {
    void options.clock.nowEpochMs();
    return c.json({
      status: "ok" as const,
      uptimeSeconds: uptimeSeconds(),
      version: options.version,
    });
  });
}
