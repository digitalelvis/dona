import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { bootstrap, createLogger, logger } from "../src/index.js";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const pkgVersion = (JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string }).version;

describe("logger", () => {
  afterEach(() => {
    bootstrap({ service: "test-reset", version: "0.0.0", env: "test" });
  });

  it("createLogger returns child with bindings", () => {
    const child = createLogger({ req: "x" });
    expect(child.bindings().req).toBe("x");
  });

  it("bootstrap applies service, version, and env", () => {
    bootstrap({ service: "my-api", version: "1.2.3", env: "staging" });
    expect(logger.bindings().service).toBe("my-api");
    expect(logger.bindings().version).toBe("1.2.3");
    expect(logger.bindings().env).toBe("staging");
  });

  it("bootstrap defaults version from observability package.json", () => {
    bootstrap({ service: "api" });
    expect(logger.bindings().version).toBe(pkgVersion);
  });

  it("default logger supports info level after bootstrap", () => {
    bootstrap({ service: "api" });
    expect(logger.info).toBeTypeOf("function");
  });
});
