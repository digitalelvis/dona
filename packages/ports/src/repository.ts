import type { DomainError, NotFoundError, Result } from "@donaoferta/core-kernel";

/**
 * Generic persistence port. Concrete domain repositories MAY extend this
 * interface with domain-specific query methods, but every concrete adapter
 * lives in `packages/adapters-*` — never in domain or kit packages.
 */
export interface Repository<TEntity, TId> {
  findById(id: TId): Promise<Result<TEntity, NotFoundError>>;
  save(entity: TEntity): Promise<Result<void, DomainError>>;
  delete(id: TId): Promise<Result<void, DomainError>>;
}
