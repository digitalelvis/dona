/**
 * Base class for every domain error. Concrete subclasses MUST declare a
 * stable string `code` so the HTTP/MCP layer can map errors deterministically.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }

  toJSON(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
}

export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";
}

export class ConflictError extends DomainError {
  readonly code = "CONFLICT";
}

export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED";
}

export class InternalError extends DomainError {
  readonly code = "INTERNAL_ERROR";
}
