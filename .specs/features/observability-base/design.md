# observability-base Design

**Spec:** [`./spec.md`](./spec.md)
**Status:** In progress — matches current repo scaffold; ADOT + app wiring still open (see `tasks.md`).

---

## Architecture Overview

```
apps/api (Lambda)
  │
  ├── src/local.ts      ──► bootstrap({ service: 'api', env: 'local' })
  └── src/handler.ts    ──► (ADOT layer wraps before handler runs)
        │
        ▼
packages/observability
  ├── bootstrap()       ──► pino logger (stdout JSON) + OTEL SDK init
  ├── logger            ──► module-level pino instance
  └── getTraceId()      ──► reads active OTel span context

pino (stdout JSON)
  └──► CloudWatch Logs (Lambda runtime captures stdout)

ADOT Lambda Layer
  └──► OpenTelemetry SDK (auto-instrument HTTP)
        └──► X-Ray exporter (OTLP → ADOT collector → X-Ray)
```

---

## Key Decisions

### KD-1 — Logging: `pino` v9, no wrapper abstraction

`pino` is the fastest structured logger in the Node.js ecosystem. The `packages/observability` package exports a `createLogger(options)` factory and a default `logger` instance. No custom wrapper class — consumers get a real `pino.Logger` so they can use its full API without fighting abstractions.

Log level is controlled by the `LOG_LEVEL` environment variable (default `info`).

### KD-2 — ADOT via Lambda layer, zero code changes to hot path

AWS Distro for OpenTelemetry (ADOT) ships a Lambda layer that auto-instruments Node.js by setting `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-handler`. This means OpenTelemetry is initialised before any handler code runs — the Lambda function itself does not need to call any OTEL SDK init function. The Terraform `api` stack adds the layer ARN and environment variable.

The `packages/observability` package still exports `getTraceId()` (reads the active span context) and a lightweight OTEL SDK init for local development where the ADOT layer is absent.

### KD-3 — `traceId` in `/health` via `getTraceId()`

The health handler reads `getTraceId()` and includes it in the response body. When no active span exists (local), the field is `null`. When the ADOT layer is active, the trace ID is the X-Ray-format string.

### KD-4 — X-Ray trace ID format

X-Ray uses the format `1-<unix-hex8>-<random-hex24>`. The OpenTelemetry SDK running under ADOT automatically propagates this format. `getTraceId()` reads `trace.getActiveSpan()?.spanContext().traceId` and converts it to X-Ray format.

### KD-5 — `packages/observability` role: `"kit"`, allowed imports: `@donaoferta/core-kernel`, `pino`, `@opentelemetry/*`

The package follows the same boundary rules as `packages/http-kit`. No `@aws-sdk/*` imports. The ADOT integration happens purely through environment variables and the Lambda layer — no SDK-specific code in the package.

### KD-6 — `pino-pretty` dev transport: opt-in only

`pino-pretty` is a `devDependency`. It is loaded only when `NODE_ENV === 'development'` and the process is not running in Lambda (`!process.env.LAMBDA_TASK_ROOT`). Production Lambda always gets plain JSON.

### KD-7 — ADOT layer ARN: parameterised in Terraform, arm64 for cost

Lambda arm64 (`graviton2`) is 20% cheaper than x86_64 at same memory. The ADOT layer is available for both architectures. The `lambda-fn` Terraform module gains an `architecture` variable (default `arm64`). The ADOT layer ARN for `us-east-1` arm64 is parameterised as a Terraform variable to avoid hardcoding a version number that changes.

---

## Repository Layout (additions)

```
packages/
└── observability/
    ├── src/
    │   ├── index.ts          ← exports: bootstrap, logger, createLogger, getTraceId
    │   ├── logger.ts         ← pino factory + default instance
    │   ├── tracer.ts         ← OTEL SDK init + getTraceId()
    │   └── types.ts          ← BootstrapOptions interface
    ├── test/
    │   ├── logger.test.ts
    │   └── tracer.test.ts
    ├── package.json          ← role: "kit"
    ├── tsconfig.json
    └── vitest.config.ts

apps/api/src/
├── handlers/health.ts        ← UPDATED: include traceId from getTraceId()
├── local.ts                  ← UPDATED: call bootstrap()
└── handler.ts                ← UPDATED: import bootstrap (ADOT layer handles init)
```

---

## `packages/observability` API

### `bootstrap(options: BootstrapOptions): void`

```typescript
interface BootstrapOptions {
  service: string        // e.g. 'api', 'mcp', 'agent'
  version?: string       // default: from package.json
  env?: string           // default: process.env.NODE_ENV ?? 'production'
}
```

Initialises:
1. `pino` logger with the service name and version as default bindings
2. OpenTelemetry SDK (only when not in Lambda — ADOT layer handles Lambda)

### `logger: pino.Logger`

Module-level logger instance. Usable immediately after `bootstrap()` is called. Pre-configured with `service` binding once bootstrap runs.

### `createLogger(bindings?: object): pino.Logger`

Returns a child logger with additional bindings. Used by individual handlers to add `requestId` to their log context.

### `getTraceId(): string | undefined`

Reads the active OpenTelemetry span and returns the X-Ray-format trace ID (`1-<hex8>-<hex24>`). Returns `undefined` if no active span.

---

## HTTP Request Logging in `apps/api`

The `packages/http-kit` `app-factory.ts` already wires `request-id` and `error-handler` middlewares. Logging middleware is added as a third middleware:

```typescript
// packages/http-kit/src/middlewares/logger.ts
export function loggerMiddleware(log: pino.Logger) {
  return async (c: Context, next: Next) => {
    const start = Date.now()
    await next()
    log.info({
      requestId: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status,
      durationMs: Date.now() - start,
    }, 'request')
  }
}
```

Wait — this would make `packages/http-kit` depend on `packages/observability` which depends on `pino`. That creates a circular-ish dependency: `http-kit → observability → (pino)`. The `http-kit` role is `"kit"` and `observability` role is also `"kit"` — kits can import other kits.

Actually, looking at the boundaries rule: `*-kit/**` forbids `@donaoferta/(?!core-kernel|ports|.*-kit)(.*)`. So `http-kit` CAN import `observability` (both are `*-kit`). This is fine.

But to keep `http-kit` lean and avoid coupling it to `pino`, the logger middleware is implemented inside `packages/observability` (not `http-kit`) and injected into `apps/api/src/compose.ts`.

```typescript
// apps/api/src/compose.ts  (updated)
import { createApp } from '@donaoferta/http-kit'
import { createLogger } from '@donaoferta/observability'
import { loggerMiddleware } from '@donaoferta/observability'
// ...
```

---

## Terraform Changes (additions to `infra-terraform-base`)

The `api` Terraform stack is updated (separate PR or same branch — depends on execution order):

```hcl
# In stacks/api/main.tf
module "lambda" {
  # ... existing vars
  architecture = "arm64"
  layers       = [var.adot_layer_arn]
  environment_variables = {
    AWS_LAMBDA_EXEC_WRAPPER = "/opt/otel-handler"
    OTEL_SERVICE_NAME       = "donaoferta-api"
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"  # ADOT collector listens here
    LOG_LEVEL               = "info"
  }
}

variable "adot_layer_arn" {
  description = "ADOT Lambda layer ARN for nodejs arm64 in us-east-1"
  type        = string
  # Set in CI via -var or tfvars; latest ARN from https://aws-otel.github.io/docs/getting-started/lambda/lambda-js
}
```

Lambda execution role also needs `xray:PutTraceSegments` and `xray:PutTelemetryRecords` — added via a policy in the `shared` or `api` stack.

---

## Testing Strategy

| Component | Test type | What |
|---|---|---|
| `packages/observability/src/logger.ts` | unit | `createLogger` returns pino instance; bindings applied |
| `packages/observability/src/tracer.ts` | unit | `getTraceId()` returns undefined when no span; format correct when span present |
| `apps/api/src/handlers/health.ts` | unit (existing, updated) | `traceId` field present in response (null when no span) |
| ADOT layer integration | E2E (manual after deploy) | X-Ray trace visible in console |

---

## Dependency Graph (packages)

```
apps/api
  └── @donaoferta/observability  (NEW)
        ├── @donaoferta/core-kernel
        ├── pino
        └── @opentelemetry/api
              (SDK init only — ADOT layer handles the rest on Lambda)
```

`@opentelemetry/api` is the thin interface package (no exporter, no SDK). The heavy SDK (`@opentelemetry/sdk-node`) is only imported when `bootstrap()` is called in non-Lambda environments.
