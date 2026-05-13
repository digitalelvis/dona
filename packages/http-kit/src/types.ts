/** Hono Env shape declaring the variables `http-kit` installs on every context. */
export interface HttpKitVariables {
  requestId: string;
}

export interface HttpKitEnv {
  Variables: HttpKitVariables;
}
