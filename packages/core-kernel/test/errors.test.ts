import { describe, expect, it } from "vitest";

import {
  ConflictError,
  DomainError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../src/index.js";

describe("DomainError", () => {
  it("is abstract — must be subclassed to be useful (smoke check via subclass)", () => {
    const e = new NotFoundError("x");
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toBeInstanceOf(Error);
  });

  it("sets `name` from the concrete subclass constructor", () => {
    expect(new NotFoundError("x").name).toBe("NotFoundError");
    expect(new ValidationError("x").name).toBe("ValidationError");
    expect(new ConflictError("x").name).toBe("ConflictError");
    expect(new UnauthorizedError("x").name).toBe("UnauthorizedError");
    expect(new InternalError("x").name).toBe("InternalError");
  });

  it("serializes to { code, message } via toJSON()", () => {
    const e = new ValidationError("price must be > 0");
    expect(e.toJSON()).toEqual({ code: "VALIDATION_ERROR", message: "price must be > 0" });
    expect(JSON.parse(JSON.stringify(e))).toEqual({
      code: "VALIDATION_ERROR",
      message: "price must be > 0",
    });
  });

  it("preserves the original error via `cause` when provided", () => {
    const cause = new Error("underlying");
    const e = new InternalError("wrapped", { cause });
    expect(e.cause).toBe(cause);
  });
});

describe("DomainError subclasses carry stable codes", () => {
  const cases: ReadonlyArray<[DomainError, string]> = [
    [new NotFoundError("a"), "NOT_FOUND"],
    [new ValidationError("a"), "VALIDATION_ERROR"],
    [new ConflictError("a"), "CONFLICT"],
    [new UnauthorizedError("a"), "UNAUTHORIZED"],
    [new InternalError("a"), "INTERNAL_ERROR"],
  ];

  it.each(cases)("%o exposes the documented code", (err, expectedCode) => {
    expect(err.code).toBe(expectedCode);
  });
});
