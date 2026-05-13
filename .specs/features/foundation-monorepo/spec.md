# foundation-monorepo Specification

> **Milestone:** M0 — Foundation
> **Scope size:** Large (multi-component, decisions resolved in STATE.md, no remaining gray areas)
> **Sibling features in M0:** `infra-terraform-base`, `observability-base`

## Problem Statement

The project is starting from an empty repository. Before any business feature can be specified or implemented, we need a reproducible monorepo skeleton that enforces our architectural rules (hexagonal per bounded context, no cloud SDK in the domain), supports independent app builds, and demonstrates the chosen tooling works end-to-end with a trivial running HTTP endpoint.

Without this foundation, every later feature would re-litigate package structure, build tooling, and HTTP wiring. Establishing it once, well, removes that friction permanently.

## Goals

- [ ] **G-A:** A new contributor can clone the repo and run `pnpm install && pnpm build && pnpm test && pnpm dev:api` and see a working `GET /health` endpoint on `http://localhost:3000` within 5 minutes.
- [ ] **G-B:** The architectural rules are enforceable at lint time: importing an AWS SDK (or any cloud SDK) from `packages/*` or `apps/*` fails CI.
- [ ] **G-C:** Every package and app builds to its own `dist/`, can be cached by Turborepo, and produces a deterministic artifact.
- [ ] **G-D:** The composition-root pattern is demonstrated end-to-end in `apps/api`: the Hono handler depends only on use-cases through interfaces; concrete implementations are wired at startup.

## Out of Scope

| Feature                                                       | Reason                                                                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Terraform / IaC                                               | Belongs to `infra-terraform-base`                                                                                                            |
| OpenTelemetry, pino logger, X-Ray                             | Belongs to `observability-base`                                                                                                              |
| Domain logic (Store, Branch, Product, etc.)                   | Belongs to M1+ features; this feature only ships scaffolding                                                                                 |
| Lambda-specific adapter (`aws-lambda` event/context handling) | This feature only requires `/health` to run locally; Lambda wiring lands in `infra-terraform-base` together with the API Gateway integration |
| MCP server, AI agent, Price Collector                         | Future milestones                                                                                                                            |
| GitHub Actions workflows                                      | Drafted here only as far as `pnpm` scripts shape; full CI lands in `infra-terraform-base` where it needs OIDC and Terraform                  |
| Husky / commitlint / changesets                               | Deferred until the team grows; not part of v1 monorepo foundation                                                                            |

---

## User Stories

### P1: Initialize the monorepo skeleton ⭐ MVP

**User Story:** As a developer, I want a pnpm + Turborepo monorepo with the agreed package layout so that I can start adding domain packages and apps without re-deciding structure.

**Why P1:** Every later feature depends on this skeleton being correct. It is the single blocking dependency for M1.

**Acceptance Criteria:**

1. WHEN a developer runs `pnpm install` at the repo root THEN the system SHALL resolve and install dependencies for every workspace listed in `pnpm-workspace.yaml`.
2. WHEN a developer runs `pnpm -w turbo run build` THEN Turborepo SHALL build every package and app, respecting the dependency graph, and produce a `dist/` per workspace.
3. WHEN a developer runs `pnpm -w turbo run typecheck` THEN every workspace SHALL pass TypeScript checks with `strict` and `noUncheckedIndexedAccess` enabled, and the command SHALL exit non-zero if any error is found.
4. WHEN a developer adds a new package under `packages/` following the documented template THEN it SHALL be automatically picked up by pnpm and Turborepo with no additional config.
5. WHEN a developer inspects the repo root THEN the following directories SHALL exist with `package.json` files marking them as workspaces: `apps/api/`, `packages/core-kernel/`, `packages/ports/`, `packages/http-kit/`.

**Independent Test:** Clone a freshly created repo, run `pnpm install && pnpm -w turbo run build typecheck test`, and observe a green run with all four workspaces touched.

---

### P1: Provide the core kernel primitives ⭐ MVP

**User Story:** As an engineer writing domain code, I want a `core-kernel` package with the reusable primitives (Result, Id, Clock, base error types) so that every domain package has the same vocabulary for cross-cutting concerns and stays free of cloud-specific code.

**Why P1:** Domain packages cannot be written without these primitives — they appear in every use-case signature.

**Acceptance Criteria:**

1. WHEN domain code returns a fallible operation THEN it SHALL use the `Result<T, E>` type exported by `core-kernel`.
2. WHEN domain code needs the current time THEN it SHALL depend on the `Clock` interface from `core-kernel` (never `Date.now()` directly).
3. WHEN domain code needs a new identifier THEN it SHALL depend on the `IdGenerator` interface from `core-kernel` (never `crypto.randomUUID()` directly).
4. WHEN a domain error is raised THEN it SHALL extend `DomainError` from `core-kernel`, carrying a stable `code: string` and a human-readable `message`.
5. WHEN `core-kernel` is imported THEN it SHALL have **zero** runtime dependencies (only TypeScript types and a `tsconfig`).
6. WHEN `Result` and the base error class are unit-tested THEN coverage SHALL be 100 % for the kernel package.

**Independent Test:** Run `pnpm --filter @donaoferta/core-kernel test` and observe a green Vitest run with explicit coverage assertions on `Result.ok`, `Result.err`, `Result.map`, `Result.flatMap`, and `DomainError.toJSON()`.

---

### P1: Define cross-cutting ports ⭐ MVP

**User Story:** As an engineer wiring an app, I want a `ports` package with the interfaces for every cross-cutting capability (repository, event bus, cache, HTTP client, secret store) so that domain packages can stay free of concrete adapter dependencies.

**Why P1:** Without these interfaces, the first domain package would inevitably leak adapter details and the portability guarantee (G4) would be lost from day one.

**Acceptance Criteria:**

1. WHEN a domain use-case needs persistence THEN it SHALL depend on a `Repository<T, Id>` generic interface (or a specialization of it) exported by `ports`.
2. WHEN a domain use-case needs to publish a domain event THEN it SHALL depend on the `EventBus` interface from `ports`.
3. WHEN a domain use-case needs caching THEN it SHALL depend on the `Cache` interface from `ports`.
4. WHEN a domain use-case needs to talk HTTP to an external service THEN it SHALL depend on the `HttpClient` interface from `ports` (never `fetch` directly).
5. WHEN a domain use-case needs secrets THEN it SHALL depend on the `SecretStore` interface from `ports`.
6. WHEN `ports` is imported THEN it SHALL have **zero** runtime dependencies and **no** imports from any `adapters-*` package.

**Independent Test:** Verify with a static check (`tsx tools/check-deps.ts`) that `ports/package.json` has no `dependencies` field with cloud SDKs, and that no file under `ports/src/` imports anything outside `@donaoferta/core-kernel`.

---

### P1: Stand up `apps/api` with a `/health` endpoint ⭐ MVP

**User Story:** As a developer, I want a runnable Hono app exposing `GET /health` so that I can prove the toolchain works end-to-end before adding any real domain logic.

**Why P1:** This is the smallest end-to-end slice that demonstrates the monorepo, the build pipeline, the composition-root pattern, and the chosen HTTP framework.

**Acceptance Criteria:**

1. WHEN a developer runs `pnpm dev:api` THEN the system SHALL start Hono on `http://localhost:3000` and log the bound port.
2. WHEN a client sends `GET http://localhost:3000/health` THEN the system SHALL respond with HTTP `200` and a JSON body shaped as `{ status: "ok", uptimeSeconds: number, version: string }`.
3. WHEN a client sends `GET http://localhost:3000/unknown` THEN the system SHALL respond with HTTP `404` and a JSON body `{ error: { code: "NOT_FOUND", message: string } }`.
4. WHEN `apps/api` boots THEN it SHALL build its dependency graph in a single `compose.ts` (composition root), instantiating concrete `Clock` and `IdGenerator` from `core-kernel` and injecting them into the handlers.
5. WHEN any handler in `apps/api` is unit-tested THEN it SHALL be tested with fake/stub implementations of the ports (no real cloud calls).
6. WHEN the app is built (`pnpm -w turbo run build --filter=@donaoferta/api`) THEN it SHALL emit a bundled `dist/` ready for both local `node dist/local.js` and (later) Lambda handler use.

**Independent Test:** Run `pnpm dev:api`, then `curl -s localhost:3000/health | jq` and observe the expected shape. Stop the server, then `pnpm --filter @donaoferta/api test` returns green.

---

### P1: Enforce architectural boundaries via lint ⭐ MVP

**User Story:** As a tech lead, I want lint rules that fail CI when a cloud SDK is imported from `packages/*` or `apps/*`, so that the portability guarantee is verifiable, not aspirational.

**Why P1:** The portability constraint (G4 in PROJECT.md) is meaningless without automated enforcement; it would regress within weeks.

**Acceptance Criteria:**

1. WHEN any file under `packages/*/src/**` or `apps/*/src/**` imports a package whose name starts with `@aws-sdk/`, `@google-cloud/`, `aws-cdk-lib`, or `firebase-admin` THEN the lint rule SHALL flag it as an error.
2. WHEN any file under `packages/*/src/**` imports anything from `packages/adapters-*` THEN the lint rule SHALL flag it as an error.
3. WHEN any file under `packages/ports/src/**` imports any package other than `@donaoferta/core-kernel` THEN the lint rule SHALL flag it as an error.
4. WHEN the lint script runs in CI THEN the command SHALL exit non-zero on any violation.
5. WHEN a contributor needs to add a new restricted boundary in the future THEN the configuration file holding these rules SHALL be a single, documented source of truth (e.g., `tools/lint-rules/`).

**Independent Test:** Add a temporary file `packages/ports/src/_violation.ts` containing `import { DynamoDBClient } from "@aws-sdk/client-dynamodb"`, run `pnpm lint`, observe a fail with a clear rule name and file pointer, then delete the file and observe a green run.

---

### P2: Centralized TypeScript configuration

**User Story:** As an engineer adding a new package, I want shared `tsconfig` presets so that every workspace inherits the same strict settings without duplication.

**Why P2:** Quality-of-life and consistency; not blocking M1 work but pays off quickly.

**Acceptance Criteria:**

1. WHEN a new package is created THEN its `tsconfig.json` SHALL extend `tsconfig.base.json` (for libs) or `tsconfig.app.json` (for apps).
2. WHEN any package overrides a strict flag downward THEN the lint configuration SHALL flag it as an error.

**Independent Test:** Inspect every `tsconfig.json` under `packages/` and `apps/`; verify each extends one of the two presets and overrides nothing risky.

---

### P2: Shared lint and format presets

**User Story:** As an engineer, I want a single ESLint and Prettier configuration applied across the monorepo so that style discussions are settled and consistent.

**Why P2:** Quality-of-life.

**Acceptance Criteria:**

1. WHEN `pnpm lint` is run at the root THEN every workspace SHALL be linted against the same shared config.
2. WHEN `pnpm format` is run at the root THEN every file SHALL be formatted with Prettier using the shared config.
3. WHEN a file violates the shared style THEN CI SHALL fail.

**Independent Test:** Introduce a deliberate style violation, observe `pnpm lint` fail; revert and observe green.

---

### P3: Pre-commit hook to run lint and typecheck on staged files

**User Story:** As an engineer, I want a fast pre-commit hook so that obvious mistakes are caught before pushing.

**Why P3:** Nice to have; CI is the gate.

**Acceptance Criteria:**

1. WHEN a developer runs `git commit` THEN the system SHALL run `pnpm lint --filter=...changed` and `pnpm typecheck --filter=...changed` on staged files.
2. WHEN a hook fails THEN the commit SHALL be aborted with a clear message.

**Independent Test:** Stage a file with a deliberate type error, run `git commit`, observe abort.

---

## Edge Cases

- WHEN `pnpm install` runs on a machine without the expected Node version THEN the system SHALL fail fast with a clear message pointing at the `engines` field in the root `package.json` (Node 22.x).
- WHEN a Turborepo cache becomes inconsistent THEN running `pnpm -w turbo run build --force` SHALL produce a clean rebuild.
- WHEN a developer adds a circular dependency between two packages THEN `pnpm -w turbo run build` SHALL fail with a readable cycle report.
- WHEN a developer attempts to import from a package not declared in their own `package.json` dependencies THEN TypeScript SHALL fail the build (no implicit cross-workspace imports).
- WHEN the `/health` handler is hit during a degraded state (e.g., a future readiness probe fails) THEN the response SHALL still return `200` for liveness with a `status: "degraded"` discriminator (initially always `"ok"`; the discriminator is reserved for later use).

---

## Requirement Traceability

| Requirement ID | Story                                         | Phase  | Status  |
| -------------- | --------------------------------------------- | ------ | ------- |
| FOUND-01       | P1: Initialize the monorepo skeleton          | Design | Pending |
| FOUND-02       | P1: Initialize the monorepo skeleton          | Design | Pending |
| FOUND-03       | P1: Initialize the monorepo skeleton          | Design | Pending |
| FOUND-04       | P1: Initialize the monorepo skeleton          | Design | Pending |
| FOUND-05       | P1: Initialize the monorepo skeleton          | Design | Pending |
| FOUND-06       | P1: Provide the core kernel primitives        | Design | Pending |
| FOUND-07       | P1: Provide the core kernel primitives        | Design | Pending |
| FOUND-08       | P1: Provide the core kernel primitives        | Design | Pending |
| FOUND-09       | P1: Provide the core kernel primitives        | Design | Pending |
| FOUND-10       | P1: Provide the core kernel primitives        | Design | Pending |
| FOUND-11       | P1: Provide the core kernel primitives        | Design | Pending |
| FOUND-12       | P1: Define cross-cutting ports                | Design | Pending |
| FOUND-13       | P1: Define cross-cutting ports                | Design | Pending |
| FOUND-14       | P1: Define cross-cutting ports                | Design | Pending |
| FOUND-15       | P1: Define cross-cutting ports                | Design | Pending |
| FOUND-16       | P1: Define cross-cutting ports                | Design | Pending |
| FOUND-17       | P1: Define cross-cutting ports                | Design | Pending |
| FOUND-18       | P1: Stand up apps/api with /health            | Design | Pending |
| FOUND-19       | P1: Stand up apps/api with /health            | Design | Pending |
| FOUND-20       | P1: Stand up apps/api with /health            | Design | Pending |
| FOUND-21       | P1: Stand up apps/api with /health            | Design | Pending |
| FOUND-22       | P1: Stand up apps/api with /health            | Design | Pending |
| FOUND-23       | P1: Stand up apps/api with /health            | Design | Pending |
| FOUND-24       | P1: Enforce architectural boundaries via lint | Design | Pending |
| FOUND-25       | P1: Enforce architectural boundaries via lint | Design | Pending |
| FOUND-26       | P1: Enforce architectural boundaries via lint | Design | Pending |
| FOUND-27       | P1: Enforce architectural boundaries via lint | Design | Pending |
| FOUND-28       | P1: Enforce architectural boundaries via lint | Design | Pending |
| FOUND-29       | P2: Centralized TypeScript configuration      | -      | Pending |
| FOUND-30       | P2: Centralized TypeScript configuration      | -      | Pending |
| FOUND-31       | P2: Shared lint and format presets            | -      | Pending |
| FOUND-32       | P2: Shared lint and format presets            | -      | Pending |
| FOUND-33       | P2: Shared lint and format presets            | -      | Pending |
| FOUND-34       | P3: Pre-commit hook                           | -      | Pending |
| FOUND-35       | P3: Pre-commit hook                           | -      | Pending |

**ID format:** `FOUND-NN`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 35 total — to be mapped to tasks during the `tasks.md` phase

---

## Success Criteria

How we know the feature is successful:

- [ ] A fresh contributor reaches a working `GET /health` locally in ≤ 5 minutes after `git clone`.
- [ ] `pnpm install && pnpm -w turbo run build typecheck test lint` is green end-to-end on a clean checkout.
- [ ] An attempted import of `@aws-sdk/*` inside `packages/*` or `apps/api` fails CI with a clear error.
- [ ] Adding a new empty package under `packages/` requires touching only its own `package.json` and `tsconfig.json` to be picked up by pnpm + Turborepo.
- [ ] No file under `packages/*`, `apps/*`, or `packages/ports` imports a cloud SDK.
