import { afterEach, describe, expect, it, vi } from "vitest";

describe("logger LOG_LEVEL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads LOG_LEVEL on module load", async () => {
    vi.stubEnv("LOG_LEVEL", "error");
    vi.stubEnv("NODE_ENV", "production");
    const { logger } = await import("../src/logger.js");
    expect(logger.level).toBe("error");
  });
});
