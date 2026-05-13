import type { DomainError, Result } from "@donaoferta/core-kernel";

export interface DomainEvent<TPayload> {
  readonly name: string;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<Result<void, DomainError>>;
}
