import { afterEach, describe, expect, it, vi } from "vitest";

describe("logger dev transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not configure pino-pretty when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LAMBDA_TASK_ROOT", undefined);
    const { logger } = await import("../src/logger.js");
    expect(logger.bindings()).toEqual({});
  });
});
