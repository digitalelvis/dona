import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkDependencies } from "./check-deps.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, "fixtures/check-deps");

describe("checkDependencies", () => {
  it("returns no violations when ports depends only on core-kernel", async () => {
    const result = await checkDependencies(resolve(FIXTURES, "ports-valid"));
    expect(result.violations).toHaveLength(0);
    expect(result.missingRole).toHaveLength(0);
    expect(result.scanned).toContain("@fixture/ports");
  });

  it("flags a cloud SDK in a ports package", async () => {
    const result = await checkDependencies(resolve(FIXTURES, "ports-violation"));
    expect(result.missingRole).toHaveLength(0);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.dependency).toBe("@aws-sdk/client-dynamodb");
    expect(result.violations[0]?.role).toBe("ports");
    expect(result.violations[0]?.reason).toMatch(/cloud SDK/i);
  });

  it("allows cloud SDKs in adapters", async () => {
    const result = await checkDependencies(resolve(FIXTURES, "adapter-allowed"));
    expect(result.violations).toHaveLength(0);
    expect(result.scanned).toContain("@fixture/adapters-aws");
  });

  it("reports packages that omit donaoferta.role", async () => {
    const result = await checkDependencies(resolve(FIXTURES, "missing-role"));
    expect(result.missingRole).toContain("@fixture/orphan");
    expect(result.violations).toHaveLength(0);
  });

  it("accepts core-role packages with zero runtime dependencies", async () => {
    const result = await checkDependencies(resolve(FIXTURES, "core-zero-deps"));
    expect(result.violations).toHaveLength(0);
  });

  it("flags any runtime dependency in a core-role package", async () => {
    const result = await checkDependencies(resolve(FIXTURES, "core-bad-dep"));
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.dependency).toBe("lodash");
    expect(result.violations[0]?.reason).toMatch(/zero runtime dependencies/i);
  });
});
