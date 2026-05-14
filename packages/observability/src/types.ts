export interface BootstrapOptions {
  readonly service: string;
  readonly version?: string;
  /** Defaults to `process.env.NODE_ENV` or `"production"`. */
  readonly env?: string;
}
