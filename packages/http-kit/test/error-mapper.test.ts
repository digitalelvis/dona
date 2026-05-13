import {
  ConflictError,
  DomainError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@donaoferta/core-kernel";
import { describe, expect, it } from "vitest";

import { mapDomainErrorToHttp, mapUnknownErrorToHttp } from "../src/error-mapper.js";

class CustomDomainError extends DomainError {
  readonly code = "CUSTOM";
}

describe("mapDomainErrorToHttp", () => {
  const cases = [
    [new ValidationError("bad"), 400, "VALIDATION_ERROR"],
    [new UnauthorizedError("nope"), 401, "UNAUTHORIZED"],
    [new NotFoundError("gone"), 404, "NOT_FOUND"],
    [new ConflictError("dup"), 409, "CONFLICT"],
    [new InternalError("boom"), 500, "INTERNAL_ERROR"],
  ] as const;

  it.each(cases)("maps %o to %i / %s", (err, status, code) => {
    const result = mapDomainErrorToHttp(err);
    expect(result.status).toBe(status);
    expect(result.body.error.code).toBe(code);
    expect(result.body.error.message).toBe(err.message);
    expect(result.body.error.requestId).toBeUndefined();
  });

  it("includes requestId in the body when provided", () => {
    const r = mapDomainErrorToHttp(new NotFoundError("x"), "req-123");
    expect(r.body.error.requestId).toBe("req-123");
  });

  it("falls back to INTERNAL_ERROR (500) for unknown DomainError subclasses", () => {
    const r = mapDomainErrorToHttp(new CustomDomainError("weird"), "req-99");
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe("INTERNAL_ERROR");
    expect(r.body.error.requestId).toBe("req-99");
  });
});

describe("mapUnknownErrorToHttp", () => {
  it("sanitizes the message and always returns 500", () => {
    const r = mapUnknownErrorToHttp(new Error("secret stack trace"), "req-1");
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe("INTERNAL_ERROR");
    expect(r.body.error.message).toBe("Internal server error");
    expect(r.body.error.requestId).toBe("req-1");
  });

  it("handles non-Error throwables without leaking their value", () => {
    const r = mapUnknownErrorToHttp("a thrown string");
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe("INTERNAL_ERROR");
    expect(r.body.error.message).toBe("Internal server error");
    expect(r.body.error.requestId).toBeUndefined();
  });
});
