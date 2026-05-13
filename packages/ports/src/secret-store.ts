import type { NotFoundError, Result } from "@donaoferta/core-kernel";

export interface SecretStore {
  get(name: string): Promise<Result<string, NotFoundError>>;
}
