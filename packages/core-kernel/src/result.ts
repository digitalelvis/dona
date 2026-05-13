import type { DomainError } from "./errors.js";

export interface Ok<T> {
  readonly _tag: "ok";
  readonly value: T;
}

export interface Err<E extends DomainError> {
  readonly _tag: "err";
  readonly error: E;
}

export type Result<T, E extends DomainError> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { _tag: "ok", value };
}

export function err<E extends DomainError>(error: E): Err<E> {
  return { _tag: "err", error };
}

function isOk<T, E extends DomainError>(result: Result<T, E>): result is Ok<T> {
  return result._tag === "ok";
}

function isErr<T, E extends DomainError>(result: Result<T, E>): result is Err<E> {
  return result._tag === "err";
}

function map<T, U, E extends DomainError>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result._tag === "ok" ? ok(fn(result.value)) : result;
}

function flatMap<T, U, E extends DomainError, F extends DomainError>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> {
  return result._tag === "ok" ? fn(result.value) : result;
}

/**
 * Returns the contained `Ok` value or throws the contained `Err.error`.
 * Use only when the caller is certain the result is `Ok` (tests, top-level
 * boundary code). Domain code should pattern-match with `isOk` / `isErr`.
 */
function unwrap<T, E extends DomainError>(result: Result<T, E>): T {
  if (result._tag === "ok") return result.value;
  throw result.error;
}

export const Result = { isOk, isErr, map, flatMap, unwrap } as const;
