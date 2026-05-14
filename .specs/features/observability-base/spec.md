# observability-base Specification

> **Milestone:** M0 — Foundation
> **Scope size:** Large (new package + integration into apps/api + Lambda layer)
> **Sibling features in M0:** `foundation-monorepo` ✅, `infra-terraform-base` ✅, `observability-base` 🚧
> **Depends on:** `foundation-monorepo` ✅, `infra-terraform-base` (Lambda deployment must exist for ADOT layer and X-Ray to work end-to-end)

## Problem Statement

`apps/api` is deployed to Lambda but runs blind: there are no structured logs, no distributed traces, and no way to correlate a `GET /health` call with its Lambda invocation in CloudWatch. In M1, once real domain features land (store queries, geo search), debugging production issues without observability will be impossible.

This feature wires the observability stack before any business feature lands: structured JSON logs via `pino`, OpenTelemetry traces exported to AWS X-Ray via the ADOT Lambda layer, and a `packages/observability` library that gives every app a consistent, zero-config bootstrap.

## Goals

- [ ] **G-A:** Every Lambda invocation of `apps/api` produces a structured JSON log line to CloudWatch Logs with at minimum `{"level":"info","msg":"...","requestId":"...","traceId":"..."}`.
- [ ] **G-B:** `GET /health` produces an X-Ray trace visible in the AWS X-Ray console, with a `traceId` field in the response body.
- [ ] **G-C:** `packages/observability` exposes a single `bootstrap(options)` function that any future `apps/*` can call at startup to initialise logging + tracing without duplicating configuration.
- [ ] **G-D:** The observability package has zero dependency on any cloud SDK in its public interface — the AWS-specific ADOT wiring is configuration, not code (environment variables + Lambda layer ARN in Terraform).

## Out of Scope

| Feature | Reason |
| --- | --- |
| CloudWatch dashboards | M5 (observability hardening) |
| SLO-based alerts | M5 |
| Custom metrics (CloudWatch EMF) | Deferred until real traffic data drives metric design |
| OpenSearch / ELK | Not in v1 |
| Distributed tracing between multiple services | Only `apps/api` exists in M0 |
| Log retention policy / log group configuration | Default 7-day retention acceptable for `dev`; configurable in Terraform |

---

## User Stories

### P1: Structured JSON logging via `pino` ⭐ MVP

**User Story:** As an on-call engineer, I want every HTTP request to `apps/api` to produce a structured JSON log line in CloudWatch so that I can filter, search and correlate logs without parsing plaintext.

**Why P1:** Unstructured logs from Lambda are nearly unusable at scale. `pino` is the fastest structured logger for Node.js and the standard in the ecosystem.

**Acceptance Criteria:**

1. WHEN `apps/api` handles an HTTP request THEN it SHALL emit a JSON log line containing at least `level`, `msg`, `requestId`, and `time` (Unix epoch ms).
2. WHEN a request completes successfully THEN the log line SHALL include the HTTP `method`, `path`, `statusCode`, and `durationMs`.
3. WHEN an error is thrown THEN the log line SHALL include `err.message`, `err.stack`, and `err.code`.
4. WHEN running locally (not Lambda) THEN the logger SHALL use `pino-pretty` in development for human-readable output (opt-in via `NODE_ENV=development`).
5. WHEN `packages/observability` exports the logger factory THEN the factory SHALL accept a `service` string and return a pre-configured `pino.Logger` instance.

**Independent Test:** Start `pnpm dev:api`, make a `GET /health`, observe a JSON line on stdout with the required fields.

---

### P1: OpenTelemetry tracing via ADOT Lambda layer ⭐ MVP

**User Story:** As an engineer, I want every Lambda invocation to produce an X-Ray trace, so that I can see end-to-end latency and identify cold starts in the AWS X-Ray console.

**Why P1:** Tracing is the most actionable observability signal for a serverless API: it shows cold-start contribution, per-handler latency, and (in M2+) downstream DynamoDB call timing.

**Acceptance Criteria:**

1. WHEN `apps/api` runs on Lambda THEN the ADOT Lambda layer (`arn:aws:lambda:<region>:901920570463:layer:aws-otel-nodejs-<arch>-ver-<version>:latest`) SHALL be attached to the function and the `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-handler` environment variable SHALL be set.
2. WHEN a request is handled THEN X-Ray SHALL show a trace with a root segment `donaoferta-api` and a child segment for the HTTP handler.
3. WHEN the `/health` response is returned THEN its JSON body SHALL include the `traceId` from the active OpenTelemetry span (format: `1-<hex8>-<hex24>`, compatible with X-Ray trace ID format).
4. WHEN `packages/observability` is imported THEN it SHALL export a `getTraceId(): string | undefined` helper that reads the active span context.
5. WHEN X-Ray is not available (local development) THEN tracing SHALL degrade gracefully — no errors thrown, `getTraceId()` returns `undefined`.

**Independent Test:** Deploy via `infra-terraform-base`, call `curl <invoke_url>/health`, observe the `traceId` field in the response, open X-Ray console and find the trace.

---

### P1: `packages/observability` bootstrap library ⭐ MVP

**User Story:** As an engineer adding a new app (`apps/mcp`, `apps/agent-runtime`), I want a single `bootstrap()` call that wires logger + tracer, so that every app has consistent observability without duplicating configuration.

**Why P1:** Consistency across apps is only achievable through a shared library. Without it, each app re-implements the wiring differently, producing inconsistent log formats and missed traces.

**Acceptance Criteria:**

1. WHEN `bootstrap({ service: 'api' })` is called at app startup THEN it SHALL initialise `pino` with the correct transport and set up OpenTelemetry SDK with the OTLP exporter configured for the ADOT layer.
2. WHEN `packages/observability` is imported by `apps/*` THEN its `package.json.donaoferta.role` SHALL be `"kit"` and it SHALL only import from `@donaoferta/core-kernel`, `pino`, and `@opentelemetry/*` — no cloud SDKs.
3. WHEN `packages/observability` is built THEN it SHALL emit `dist/*.js + *.d.ts + maps` like other library packages.
4. WHEN `apps/api/src/local.ts` and `apps/api/src/handler.ts` call `bootstrap()` THEN the logger SHALL be available via a module-level `logger` export from `packages/observability`.

**Independent Test:** Run `pnpm --filter @donaoferta/observability test`; all unit tests pass. Run `check:deps`, observe no cloud SDK imports.

---

### P2: `traceId` in `/health` response body

**User Story:** As an integrator, I want the `/health` response to include the current `traceId`, so that I can correlate a failing health check with its X-Ray trace without grepping CloudWatch.

**Why P2:** The ROADMAP acceptance criterion for M0 is `curl .../health returns 200 including traceId`. This is the requirement that makes the traceId visible externally.

**Acceptance Criteria:**

1. WHEN `GET /health` is called THEN the JSON response body SHALL include a `traceId` field.
2. WHEN no active trace is present (local without ADOT) THEN `traceId` SHALL be `null` or omitted.
3. WHEN the Lambda is cold-starting THEN the `traceId` SHALL still be present in the response (tracing is initialised before the handler runs via `AWS_LAMBDA_EXEC_WRAPPER`).

**Independent Test:** `curl <invoke_url>/health | jq .traceId` returns a non-null string in the format `1-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx`.

---

## Edge Cases

- WHEN `pino` logs a circular object THEN it SHALL not throw — `pino` handles this natively via safe serialisation.
- WHEN the ADOT layer is unavailable (e.g., wrong region ARN) THEN the Lambda SHALL still start and serve requests — traces simply won't appear.
- WHEN running in Lambda with `NODE_ENV=production` THEN `pino-pretty` SHALL NOT be loaded (it would add significant cold-start overhead).
- WHEN OpenTelemetry SDK initialisation fails (bad env var) THEN it SHALL log a warning and continue — tracing is non-critical.
- WHEN `getTraceId()` is called outside an active span context THEN it SHALL return `undefined` without throwing.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| OBS-01 | P1: Structured logging | Design | Pending |
| OBS-02 | P1: Structured logging | Design | Pending |
| OBS-03 | P1: Structured logging | Design | Pending |
| OBS-04 | P1: Structured logging | Design | Pending |
| OBS-05 | P1: Structured logging | Design | Pending |
| OBS-06 | P1: OTEL tracing via ADOT | Design | Pending |
| OBS-07 | P1: OTEL tracing via ADOT | Design | Pending |
| OBS-08 | P1: OTEL tracing via ADOT | Design | Pending |
| OBS-09 | P1: OTEL tracing via ADOT | Design | Pending |
| OBS-10 | P1: OTEL tracing via ADOT | Design | Pending |
| OBS-11 | P1: packages/observability bootstrap | Design | Pending |
| OBS-12 | P1: packages/observability bootstrap | Design | Pending |
| OBS-13 | P1: packages/observability bootstrap | Design | Pending |
| OBS-14 | P1: packages/observability bootstrap | Design | Pending |
| OBS-15 | P2: traceId in /health | Design | Pending |
| OBS-16 | P2: traceId in /health | Design | Pending |
| OBS-17 | P2: traceId in /health | Design | Pending |

**ID format:** `OBS-NN`
**Coverage:** 17 total

---

## Success Criteria

- [ ] `curl <invoke_url>/health` response body contains a non-null `traceId` from AWS X-Ray.
- [ ] CloudWatch Logs for the Lambda function shows structured JSON log lines per request.
- [ ] X-Ray console shows a trace for the `/health` call with latency breakdown.
- [ ] `pnpm check:deps` exits 0 — `packages/observability` imports no cloud SDKs.
- [ ] `pnpm --filter @donaoferta/observability test` exits 0.
