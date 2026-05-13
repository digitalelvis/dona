import { DomainError, type Result } from "@donaoferta/core-kernel";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly query?: Record<string, string | number>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
}

export interface HttpResponse<TBody> {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: TBody;
}

export class HttpClientError extends DomainError {
  readonly code = "HTTP_CLIENT_ERROR";

  constructor(
    message: string,
    readonly details: {
      readonly url: string;
      readonly status?: number;
      readonly cause?: unknown;
    },
  ) {
    super(message, details.cause !== undefined ? { cause: details.cause } : undefined);
  }
}

export interface HttpClient {
  request<TResponse>(input: HttpRequest): Promise<Result<HttpResponse<TResponse>, HttpClientError>>;
}
