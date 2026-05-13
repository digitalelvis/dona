import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkTsconfigs } from "./check-tsconfig.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, "fixtures/check-tsconfig");

describe("checkTsconfigs", () => {
  it("accepts a library tsconfig extending tools/tsconfig/base.json", async () => {
    const result = await checkTsconfigs(resolve(FIXTURES, "lib-valid"));
    expect(result.violations).toHaveLength(0);
    expect(result.scanned).toHaveLength(1);
  });

  it("accepts an app tsconfig extending tools/tsconfig/app.json", async () => {
    const result = await checkTsconfigs(resolve(FIXTURES, "app-valid"));
    expect(result.violations).toHaveLength(0);
  });

  it("flags a tsconfig that does not extend any preset", async () => {
    const result = await checkTsconfigs(resolve(FIXTURES, "no-preset"));
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.kind).toBe("no-preset");
  });

  it("flags a tsconfig that extends the wrong preset for its kind", async () => {
    const result = await checkTsconfigs(resolve(FIXTURES, "wrong-preset"));
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.kind).toBe("wrong-preset");
  });

  it("flags a tsconfig that downgrades a strict flag", async () => {
    const result = await checkTsconfigs(resolve(FIXTURES, "strict-downgrade"));
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.kind).toBe("strict-flag-downgraded");
    expect(result.violations[0]?.detail).toContain("strict");
  });
});
