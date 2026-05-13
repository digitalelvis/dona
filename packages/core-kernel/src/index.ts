export type { Clock } from "./clock.js";
export { systemClock } from "./clock.js";

export type { IdGenerator } from "./id.js";
export { uuidv4IdGenerator } from "./id.js";

export {
  DomainError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  InternalError,
} from "./errors.js";

export type { Ok, Err } from "./result.js";
export { Result, ok, err } from "./result.js";
