import { createApp } from "@donaoferta/http-kit";
import type { HttpKitApp } from "@donaoferta/http-kit";

export type ApiApp = HttpKitApp;

/** Hono app factory: wires http-kit request-id + centralized error / not-found handling. */
export function createApiApp(requestId: () => string): ApiApp {
  return createApp({ requestId });
}
