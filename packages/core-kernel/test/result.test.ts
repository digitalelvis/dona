import { describe, expect, it } from "vitest";

import {
  ConflictError,
  err,
  InternalError,
  NotFoundError,
  ok,
  Result,
  ValidationError,
} from "../src/index.js";

describe("ok / err constructors", () => {
  it("wraps a value into an Ok with the `ok` tag", () => {
    const r = ok(42);
    expect(r._tag).toBe("ok");
    expect(r.value).toBe(42);
  });

  it("wraps a DomainError into an Err with the `err` tag", () => {
    const e = new ValidationError("bad input");
    const r = err(e);
    expect(r._tag).toBe("err");
    expect(r.error).toBe(e);
  });
});

describe("Result.isOk / Result.isErr", () => {
  it("narrows the type to Ok when the result is Ok", () => {
    const r = ok("hello");
    expect(Result.isOk(r)).toBe(true);
    expect(Result.isErr(r)).toBe(false);
  });

  it("narrows the type to Err when the result is Err", () => {
    const r = err(new NotFoundError("missing"));
    expect(Result.isErr(r)).toBe(true);
    expect(Result.isOk(r)).toBe(false);
  });
});

describe("Result.map", () => {
  it("transforms the value when the result is Ok", () => {
    const r = Result.map(ok(2), (n) => n * 3);
    expect(Result.isOk(r) && r.value).toBe(6);
  });

  it("passes Err through unchanged", () => {
    const e = new ConflictError("dup");
    const r = Result.map(err(e), (n: number) => n * 3);
    expect(Result.isErr(r) && r.error).toBe(e);
  });
});

describe("Result.flatMap", () => {
  it("chains an Ok-producing fn when the input is Ok", () => {
    const r = Result.flatMap(ok(10), (n) => ok(n + 5));
    expect(Result.isOk(r) && r.value).toBe(15);
  });

  it("chains an Err-producing fn when the input is Ok", () => {
    const e = new ValidationError("invalid");
    const r = Result.flatMap(ok(10), (_) => err(e));
    expect(Result.isErr(r) && r.error).toBe(e);
  });

  it("passes Err through without invoking the fn", () => {
    const e = new NotFoundError("missing");
    let called = false;
    const r = Result.flatMap(err(e), (_: number) => {
      called = true;
      return ok(0);
    });
    expect(called).toBe(false);
    expect(Result.isErr(r) && r.error).toBe(e);
  });
});

describe("Result.unwrap", () => {
  it("returns the contained value when Ok", () => {
    expect(Result.unwrap(ok("x"))).toBe("x");
  });

  it("throws the contained error when Err", () => {
    const e = new InternalError("boom");
    expect(() => Result.unwrap(err(e))).toThrowError(e);
  });
});
