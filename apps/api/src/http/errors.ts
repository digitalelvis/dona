/**
 * App-layer re-exports for DomainError → HTTP mapping at handlers / adapters.
 * Global shaping stays in `@donaoferta/http-kit` (`createApp` + `errorHandler`).
 */
export { mapDomainErrorToHttp, mapUnknownErrorToHttp } from "@donaoferta/http-kit";
