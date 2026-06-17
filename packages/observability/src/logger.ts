import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Logger, pino } from "pino";

import type { BootstrapOptions } from "./types.js";

function readPackageVersion(): string {
  try {
    const url = import.meta.url;
    if (url === undefined || url === "") return "0.0.0";
    const packageDir = dirname(fileURLToPath(url));
    const raw = readFileSync(join(packageDir, "..", "package.json"), "utf8");
    const v = (JSON.parse(raw) as { version?: string }).version;
    return v ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const defaultPackageVersion = readPackageVersion();

function resolveLogLevel(): string {
  return process.env.LOG_LEVEL ?? "info";
}

function createBaseLogger(): Logger {
  const level = resolveLogLevel();
  if (process.env.NODE_ENV === "development" && process.env.LAMBDA_TASK_ROOT === undefined) {
    return pino({
      level,
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    });
  }
  return pino({ level });
}

const baseLogger = createBaseLogger();

/** Default logger; gains `service` / `version` bindings after `bootstrap()`. */
export let logger: Logger = baseLogger;

export function createLogger(bindings?: Record<string, unknown>): Logger {
  if (bindings === undefined) {
    return logger;
  }
  return logger.child(bindings);
}

export function bootstrapLogger(options: BootstrapOptions): void {
  const version = options.version ?? defaultPackageVersion;
  const env = options.env ?? process.env.NODE_ENV ?? "production";
  logger = baseLogger.child({ service: options.service, version, env });
}
