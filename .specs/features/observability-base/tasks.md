# observability-base Tasks

**Design:** [`./design.md`](./design.md)
**Spec:** [`./spec.md`](./spec.md)
**Status:** In progress — `packages/observability` scaffold + unit tests in repo (TO1–TO2); `apps/api` exposes `traceId: null` on `/health` pending compose/bootstrap + ADOT Terraform (TO3–TO5).

---

## Testing Conventions

Extends the matrix from `foundation-monorepo`.

### Test Coverage Matrix

| Code layer | Required test type | Rationale | Parallel-safe? |
|---|---|---|---|
| `packages/observability/src/logger.ts` | **unit** | Pure factory function, no I/O | Yes |
| `packages/observability/src/tracer.ts` | **unit** | `getTraceId()` pure read from OTel context | Yes |
| `apps/api/src/handlers/health.ts` | **unit** (update existing test) | traceId field added to response | Yes |
| Terraform `api` stack changes | **none** (tf-validate) | IaC correctness | Yes |
| ADOT end-to-end | **none** (manual E2E) | Requires deployed Lambda with ADOT layer | N/A |

### Gate Check Commands

| Gate | Command | Use when |
|---|---|---|
| **quick** | `pnpm --filter @donaoferta/observability test` | After TO1, TO2 |
| **api-test** | `pnpm --filter @donaoferta/api test` | After TO3 (health handler update) |
| **full** | `pnpm typecheck && pnpm lint && pnpm check:deps && pnpm check:tsconfig && pnpm -w turbo run test && pnpm -w turbo run build` | TO7 |

---

## Execution Plan

### Phase 1 — Core library (sequential)

```
TO1 → TO2
```

### Phase 2 — App integration (parallel after TO2, touch disjoint parts of apps/api)

```
        ┌→ TO3 [P]  (health handler: traceId)
TO2 ────┤
        └→ TO4 [P]  (compose.ts: logger middleware + bootstrap)
```

### Phase 3 — Terraform (sequential after TO4; needs compose + build)

```
TO3 + TO4 → TO5 (Terraform api stack: ADOT layer + X-Ray policy)
```

### Phase 4 — E2E verification + PR

```
TO5 → TO6
```

---

## Task Breakdown

### TO1: `packages/observability` — logger module

**What:** Create `packages/observability` with the logger factory (`src/logger.ts`) and its unit tests. The package is scaffolded with `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` (partial — tracer exports added in TO2).
**Where:**
- `packages/observability/package.json` — role: `"kit"`, deps: `pino`, `@opentelemetry/api`, devDeps: `pino-pretty`, `@donaoferta/core-kernel`, `vitest`, etc.
- `packages/observability/src/types.ts` — `BootstrapOptions` interface
- `packages/observability/src/logger.ts` — `createLogger`, `bootstrap` (partial), `logger` instance
- `packages/observability/src/index.ts` — re-exports logger symbols
- `packages/observability/test/logger.test.ts` — unit tests
- `packages/observability/tsconfig.json` — extends `tools/tsconfig/base.json`
- `packages/observability/vitest.config.ts`
- Root `tsconfig.json` — add `packages/observability` reference

**Depends on:** None (independent new package)
**Requirement:** OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-11, OBS-12, OBS-13

**Done when:**

- [ ] `package.json.donaoferta.role = "kit"`, dependencies include only `pino`, `@opentelemetry/api`, `@donaoferta/core-kernel`
- [ ] `createLogger(bindings?)` returns a configured `pino.Logger` with `level` from `LOG_LEVEL` env var (default `info`)
- [ ] `logger` is a module-level default instance (child of the root pino logger)
- [ ] `bootstrap({ service })` sets the default pino bindings (`service`, `version`) and sets `pino-pretty` transport when `NODE_ENV === 'development'` and not in Lambda
- [ ] `pnpm check:deps` exits 0 (no `@aws-sdk/*` in the package)
- [ ] Unit tests cover: `createLogger` returns instance, bindings applied, LOG_LEVEL respected, pino-pretty NOT loaded in production
- [ ] Gate: `pnpm --filter @donaoferta/observability test` exits 0, ≥ 4 tests

**Tests:** unit
**Gate:** quick

**Commit:** `feat(observability): add packages/observability with pino logger factory`

---

### TO2: `packages/observability` — tracer module

**What:** Add `src/tracer.ts` with `getTraceId()` (reads OTel active span, converts to X-Ray format) and a lightweight OTel SDK init for non-Lambda environments. Update `src/index.ts` to export tracer symbols.
**Where:**
- `packages/observability/src/tracer.ts` — NEW
- `packages/observability/src/index.ts` — update exports
- `packages/observability/test/tracer.test.ts` — NEW unit tests

**Depends on:** TO1
**Requirement:** OBS-06, OBS-08, OBS-09, OBS-10, OBS-14

**Done when:**

- [ ] `getTraceId()` reads `trace.getActiveSpan()?.spanContext()` and returns X-Ray format `1-<hex8>-<hex24>` or `undefined`
- [ ] `getTraceId()` returns `undefined` without throwing when no span is active
- [ ] `src/index.ts` exports `getTraceId` and `bootstrap` (complete, including tracer init)
- [ ] Unit tests cover: no active span → `undefined`; mock span context → correct X-Ray format; format regex passes
- [ ] Gate: `pnpm --filter @donaoferta/observability test` exits 0, ≥ 6 total tests (≥4 logger + ≥2 tracer)

**Tests:** unit
**Gate:** quick

**Commit:** `feat(observability): add OTEL tracer with getTraceId and X-Ray format`

---

### TO3: `apps/api` — health handler: include `traceId` [P]

**What:** Update `apps/api/src/handlers/health.ts` to call `getTraceId()` from `@donaoferta/observability` and include the result in the response body. Update the existing health unit test to assert `traceId` is present in the response (value is `null` in tests since no OTel context is active).
**Where:**
- `apps/api/src/handlers/health.ts` — update response shape
- `apps/api/test/health.test.ts` — update assertions
- `apps/api/package.json` — add `@donaoferta/observability` to dependencies

**Depends on:** TO2
**Requirement:** OBS-15, OBS-16, OBS-17

**Done when:**

- [ ] `health.ts` imports `getTraceId` from `@donaoferta/observability`
- [ ] Response body shape is `{ status: 'ok', uptimeSeconds: number, version: string, traceId: string | null }`
- [ ] Existing health tests updated: `traceId` field present (value `null` in test context is acceptable)
- [ ] Gate: `pnpm --filter @donaoferta/api test` exits 0

**Tests:** unit (update existing)
**Gate:** api-test

**Commit:** `feat(api): include traceId from OTEL context in /health response`

---

### TO4: `apps/api` — compose.ts: logger middleware + bootstrap [P]

**What:** Update `apps/api/src/compose.ts` to call `bootstrap({ service: 'api' })` and wire the logger middleware (access log per request). Update `apps/api/src/local.ts` to call `bootstrap` in development mode.
**Where:**
- `apps/api/src/compose.ts` — add logger middleware
- `apps/api/src/local.ts` — add `bootstrap` call
- `packages/observability/src/middlewares/logger.ts` — NEW (request logger middleware for Hono, lives in observability)

**Depends on:** TO2
**Requirement:** OBS-07, OBS-14

**Done when:**

- [ ] `packages/observability/src/middlewares/logger.ts` exports `loggerMiddleware(log: pino.Logger)` returning a Hono middleware that logs method, path, statusCode, durationMs per request
- [ ] `src/index.ts` of `packages/observability` exports `loggerMiddleware`
- [ ] `apps/api/src/compose.ts` calls `app.use('*', loggerMiddleware(logger))` after `requestId` middleware
- [ ] `apps/api/src/local.ts` calls `bootstrap({ service: 'api', env: process.env.NODE_ENV })` before starting the server
- [ ] Gate: `pnpm --filter @donaoferta/api test` exits 0 (no regression)

**Tests:** unit (middleware tested as part of existing api tests — no new test file)
**Gate:** api-test

**Commit:** `feat(api): wire logger middleware and bootstrap in compose and local`

---

### TO5: Terraform `api` stack — ADOT layer + X-Ray IAM

**What:** Update `infra/terraform/stacks/api/` to attach the ADOT Lambda layer, set `AWS_LAMBDA_EXEC_WRAPPER`, `OTEL_SERVICE_NAME`, and `LOG_LEVEL` environment variables, set architecture to `arm64`, and add X-Ray permissions to the Lambda execution role.
**Where:**
- `infra/terraform/stacks/api/main.tf` — update `module.lambda` call
- `infra/terraform/stacks/api/variables.tf` — add `adot_layer_arn` and `architecture` variables
- `infra/terraform/modules/lambda-fn/main.tf` — add `aws_iam_role_policy_attachment` for X-Ray (`arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess`) and `aws_lambda_function` resource `architectures` attribute

**Depends on:** TO3, TO4 (handler.mjs includes traceId; compose.ts is wired)
**Requirement:** OBS-06, OBS-07 (infrastructure side)

**Done when:**

- [ ] `module.lambda` in `api/main.tf` passes `layers = [var.adot_layer_arn]`, `architecture = "arm64"`, and the four environment variables from design.md
- [ ] `modules/lambda-fn/main.tf` attaches `AWSXRayDaemonWriteAccess` policy to the execution role
- [ ] `modules/lambda-fn/main.tf` `aws_lambda_function` resource sets `architectures = [var.architecture]`
- [ ] `terraform validate` exits 0 in `modules/lambda-fn/` and `stacks/api/`
- [ ] `variables.tf` in `stacks/api/` documents `adot_layer_arn` with a description pointing to the ADOT docs URL

**Tests:** none (terraform validate)
**Gate:** tf-validate

**Commit:** `feat(infra): add ADOT layer, arm64 architecture, and X-Ray IAM to api stack`

---

### TO6: End-to-end verification and PR

**What:** Deploy the updated `api` stack (with ADOT layer), smoke test the live endpoint for `traceId`, verify CloudWatch logs and X-Ray trace, run full gate suite, and open PR.
**Where:** No source files. Output is the PR description with verification log.
**Depends on:** TO5

**Done when:**

- [ ] `pnpm -w turbo run build` exits 0 with `dist/handler.mjs` updated
- [ ] `terraform apply` on `stacks/api/` succeeds (ADOT layer attached)
- [ ] `curl <invoke_url>/health | jq .traceId` returns a non-null string matching `/^1-[0-9a-f]{8}-[0-9a-f]{24}$/`
- [ ] AWS X-Ray console shows a trace for the `/health` call
- [ ] CloudWatch Logs for `donaoferta-api-dev` shows a JSON log line per request
- [ ] Full gate: `pnpm typecheck && pnpm lint && pnpm check:deps && pnpm check:tsconfig && pnpm -w turbo run test && pnpm -w turbo run build` exits 0
- [ ] Test count: ≥ 10 total tests in `@donaoferta/observability` (≥ 4 logger + ≥ 2 tracer + ≥ 4 middleware), ≥ 4 in `@donaoferta/api`
- [ ] PR opened `feat/observability-base → v0.1.x` with body referencing OBS-01..OBS-17 and verification log

**Tests:** none (this task IS the verification)
**Gate:** full + manual E2E (deployed Lambda)

**Commit:** none

---

## Validation Tables

### Check 1 — Task Granularity

| Task | Scope | Status |
|---|---|---|
| TO1: logger module | 1 package scaffold + logger src + tests | ✅ Cohesive (one deliverable: logger package initialised) |
| TO2: tracer module | 1 src file + tests + index update | ✅ Granular |
| TO3: health handler traceId | 1 handler update + test update | ✅ Granular |
| TO4: compose + bootstrap | 2 app files + 1 middleware | ✅ Cohesive (one integration concern) |
| TO5: Terraform ADOT | 2 tf files (stack + module) | ✅ Cohesive |
| TO6: E2E + PR | 0 files | ✅ Verification only |

All ✅.

### Check 2 — Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| TO1 | (none) | Phase 1 standalone | ✅ Match |
| TO2 | TO1 | TO1 → TO2 | ✅ Match |
| TO3 [P] | TO2 | TO2 → TO3 | ✅ Match |
| TO4 [P] | TO2 | TO2 → TO4 | ✅ Match |
| TO5 | TO3, TO4 | TO3+TO4 → TO5 | ✅ Match |
| TO6 | TO5 | TO5 → TO6 | ✅ Match |

All ✅.

### Check 3 — Test Co-location Validation

| Task | Code layer | Matrix requires | Task says | Status |
|---|---|---|---|---|
| TO1 | `packages/observability/src/logger.ts` | unit | unit (≥4 tests) | ✅ OK |
| TO2 | `packages/observability/src/tracer.ts` | unit | unit (≥2 tests) | ✅ OK |
| TO3 | `apps/api/src/handlers/health.ts` | unit (update) | unit (update existing) | ✅ OK |
| TO4 | `apps/api/src/compose.ts` + middleware | unit (middleware) | unit (via existing api tests) | ✅ OK |
| TO5 | Terraform IaC | none (tf-validate) | none | ✅ OK |
| TO6 | Verification only | none | none | ✅ OK |

All ✅.
