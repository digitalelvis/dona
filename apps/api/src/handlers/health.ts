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

  /** Base `invoke_url` ends with `/`; send browsers to the health contract. */
  app.get("/", (c) => c.redirect("/health", 302));

  app.get("/health", (c) => {
    void options.clock.nowEpochMs();
    return c.json({
      status: "ok" as const,
      uptimeSeconds: uptimeSeconds(),
      version: options.version,
      traceId: null,
    });
  });
}
