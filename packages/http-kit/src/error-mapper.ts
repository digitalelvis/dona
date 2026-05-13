import type { DomainError } from "@donaoferta/core-kernel";

export interface HttpProblem {
  readonly status: number;
  readonly body: {
    readonly error: {
      readonly code: string;
      readonly message: string;
      readonly requestId?: string;
    };
  };
}

/**
 * Single source of truth for DomainError → HTTP status. Adding a new
 * DomainError subclass means adding its `code` to this map; an unknown
 * code falls back to 500 to preserve fail-safe behavior.
 */
const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

function buildProblem(
  status: number,
  code: string,
  message: string,
  requestId?: string,
): HttpProblem {
  return {
    status,
    body: {
      error: {
        code,
        message,
        ...(requestId !== undefined ? { requestId } : {}),
      },
    },
  };
}

export function mapDomainErrorToHttp(err: DomainError, requestId?: string): HttpProblem {
  const status = STATUS_BY_CODE[err.code] ?? 500;
  const exposedCode = status === 500 ? "INTERNAL_ERROR" : err.code;
  return buildProblem(status, exposedCode, err.message, requestId);
}

export function mapUnknownErrorToHttp(_err: unknown, requestId?: string): HttpProblem {
  return buildProblem(500, "INTERNAL_ERROR", "Internal server error", requestId);
}

/**
 * Structural test for "is this a DomainError-shaped value?". Uses duck
 * typing instead of `instanceof` because pnpm workspaces + ESM can lead
 * to module duplication (and therefore distinct class identities) at
 * runtime — see http-kit middleware tests for the failure mode.
 */
export function isDomainErrorLike(err: unknown): err is DomainError {
  if (!(err instanceof Error)) return false;
  const candidate = err as unknown as { code?: unknown };
  return typeof candidate.code === "string" && candidate.code.length > 0;
}
