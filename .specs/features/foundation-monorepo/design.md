# foundation-monorepo Design

**Spec:** [`./spec.md`](./spec.md)
**Status:** Draft

---

## Architecture Overview

This feature delivers the monorepo skeleton that every later feature will plug into. The architecture follows **Hexagonal / Ports & Adapters per bounded context**, layered top-to-bottom:

- **Apps** compose use-cases at their composition root and expose them through a delivery mechanism (HTTP, MCP, etc.).
- **Domain packages** (later milestones — `stores`, `catalog`, `users`, `collector`, `agent`) host business rules and use-cases. They are framework- and cloud-agnostic.
- **Kit packages** (`http-kit`, `mcp-kit`, `llm-kit`, `observability`, `config`) are shared infrastructure helpers that wrap external libraries (Hono, MCP SDK, OTel, etc.).
- **Ports** is the cross-cutting interface package — every external dependency a domain package or app needs is declared here as a TypeScript interface.
- **Adapters** (`adapters-aws`, future `adapters-gcp`) implement ports against concrete clouds/SDKs. **They are the only place cloud SDKs are allowed.**
- **Core-kernel** is the dependency-free primitive package (Result, Clock, IdGenerator, DomainError).

Within this feature (M0 / `foundation-monorepo`) we only materialize `core-kernel`, `ports`, `http-kit` and `apps/api`. Domain packages, adapters and other kits are placeholders to be created in their own features.

```
┌──────────────────────────────────────────────────────────────────┐
│                              apps/                               │
│  ┌───────────┐    (future: mcp, agent-runtime, scanner-worker)   │
│  │   api     │                                                   │
│  │  Hono +   │                                                   │
│  │ compose() │                                                   │
│  └─────┬─────┘                                                   │
└────────┼─────────────────────────────────────────────────────────┘
         │ depends on
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                            packages/                             │
│                                                                  │
│   http-kit  ──┐                                                  │
│               │ uses                                             │
│               ▼                                                  │
│   ports  ───────────────────────────────►  (no impls here)       │
│      ▲                                                           │
│      │ implemented by (future)                                   │
│      │                                                           │
│   adapters-aws / adapters-gcp ──► AWS SDK / GCP SDK              │
│                                                                  │
│   core-kernel  ◄── used by everyone (zero deps, pure TS)         │
│                                                                  │
│   (future: stores, catalog, users, collector, agent,             │
│            mcp-kit, llm-kit, observability, config)              │
└──────────────────────────────────────────────────────────────────┘
```

**Dependency rules (enforced by lint — see "Architectural Enforcement" below):**

| From →                        | `core-kernel` | `ports` | domain (`stores`, …)                 | kits (`http-kit`, …) | `adapters-*`      | `apps/*` |
| ----------------------------- | ------------- | ------- | ------------------------------------ | -------------------- | ----------------- | -------- |
| `core-kernel` may depend on   | —             | ❌      | ❌                                   | ❌                   | ❌                | ❌       |
| `ports` may depend on         | ✅            | —       | ❌                                   | ❌                   | ❌                | ❌       |
| domain packages may depend on | ✅            | ✅      | other domain only via published APIs | ❌                   | ❌                | ❌       |
| kit packages may depend on    | ✅            | ✅      | ❌                                   | other kits ok        | ❌                | ❌       |
| `adapters-*` may depend on    | ✅            | ✅      | ❌                                   | ❌                   | other adapters ok | ❌       |
| `apps/*` may depend on        | ✅            | ✅      | ✅                                   | ✅                   | ✅                | ❌       |

In short: **domain and kits never import adapters**; **only apps wire concretes to ports**; **core-kernel depends on nothing**.

---

## Code Reuse Analysis

This is a greenfield repository — there is no internal code to reuse. The relevant external libraries we leverage:

| Library                                          | Role                                                     | Why                                                                                |
| ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `hono` (latest 4.x)                              | HTTP framework in `apps/api` and `http-kit`              | D-009; native Lambda adapter (`hono/aws-lambda`); streaming support; multi-runtime |
| `@hono/node-server`                              | Local Node dev server in `apps/api`                      | Verified against Hono docs; the standard way to run Hono on Node                   |
| `zod` (4.x)                                      | Schema validation everywhere                             | Already mandated by PROJECT.md                                                     |
| `vitest`                                         | Unit + integration test runner                           | Vite-native; first-class TS support; ESM friendly                                  |
| `eslint` (9.x flat config) + `typescript-eslint` | Lint engine                                              | Modern flat-config required for the boundary rules below                           |
| `eslint-plugin-boundaries`                       | Architectural boundary enforcement                       | Declarative element-type rules match our layer model precisely                     |
| `prettier`                                       | Formatting                                               | Single source of truth for style                                                   |
| `tsx`                                            | Run TS scripts (`tools/check-deps.ts`, dev server entry) | No compile step for tooling                                                        |
| `tsup`                                           | Bundle apps (later: Lambda zips)                         | Single-file ESM output; tree-shakes; supports `esbuild` plugins                    |
| `turbo` (2.x)                                    | Task orchestration + cache                               | D-005                                                                              |
| `pnpm` (9.x)                                     | Workspace manager + lockfile                             | D-005; `engines` enforces version                                                  |

**Integration points** with future features: `core-kernel`, `ports`, `http-kit` and the `compose.ts` pattern in `apps/api` are the contracts that every later feature must extend without modifying.

---

## Repository Layout (this feature only materializes the bold paths)

```
dona/
├── .specs/                                ← already exists
├── .cursor/                               ← already exists
├── apps/
│   └── api/                               ★ this feature
│       ├── src/
│       │   ├── compose.ts                 ← composition root
│       │   ├── handlers/
│       │   │   └── health.ts
│       │   ├── http/
│       │   │   ├── app.ts                 ← Hono app factory
│       │   │   └── errors.ts              ← error → HTTP mapping
│       │   ├── local.ts                   ← `pnpm dev:api` entry (Node server)
│       │   └── version.ts                 ← read from package.json at build time
│       ├── test/
│       │   └── health.test.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
├── packages/
│   ├── core-kernel/                       ★ this feature
│   │   ├── src/
│   │   │   ├── result.ts
│   │   │   ├── clock.ts
│   │   │   ├── id.ts
│   │   │   ├── errors.ts
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   ├── result.test.ts
│   │   │   └── errors.test.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ports/                             ★ this feature
│   │   ├── src/
│   │   │   ├── repository.ts
│   │   │   ├── event-bus.ts
│   │   │   ├── cache.ts
│   │   │   ├── http-client.ts
│   │   │   ├── secret-store.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── http-kit/                          ★ this feature
│       ├── src/
│       │   ├── app-factory.ts             ← `createApp({ deps })`
│       │   ├── error-mapper.ts            ← DomainError → HTTP problem JSON
│       │   ├── middlewares/
│       │   │   ├── request-id.ts
│       │   │   └── error-handler.ts
│       │   └── index.ts
│       ├── test/
│       │   └── error-mapper.test.ts
│       ├── package.json
│       └── tsconfig.json
├── tools/                                 ★ this feature
│   ├── lint-rules/
│   │   └── boundaries.js                  ← eslint-plugin-boundaries config fragment
│   ├── tsconfig/
│   │   ├── base.json                      ← shared `tsconfig.base.json`
│   │   └── app.json                       ← shared `tsconfig.app.json`
│   └── check-deps.ts                      ← `tsx` script for FOUND-17 static check
├── .gitignore                             ← already exists, extend
├── .nvmrc                                 ★ this feature  (Node 22 LTS)
├── .npmrc                                 ★ this feature
├── .editorconfig                          ★ this feature
├── eslint.config.js                       ★ this feature  (flat config)
├── prettier.config.js                     ★ this feature
├── package.json                           ★ this feature  (root, private)
├── pnpm-workspace.yaml                    ★ this feature
├── tsconfig.json                          ★ this feature  (solution root w/ project refs)
├── turbo.json                             ★ this feature
└── README.md                              ★ this feature  (bootstrap instructions)
```

---

## Components

### `core-kernel`

- **Purpose:** Reusable primitives with zero runtime dependencies.
- **Location:** `packages/core-kernel/`
- **Package name:** `@donaoferta/core-kernel`
- **Public interface (exported by `src/index.ts`):**
  - `type Result<T, E extends DomainError> = Ok<T> | Err<E>`
  - `const ok: <T>(value: T) => Ok<T>`
  - `const err: <E extends DomainError>(error: E) => Err<E>`
  - `Result.map(result, fn)`, `Result.flatMap(result, fn)`, `Result.unwrap(result)`, `Result.isOk(result)`, `Result.isErr(result)` (free functions; no class)
  - `interface Clock { now(): Date; nowEpochMs(): number }`
  - `const systemClock: Clock`
  - `interface IdGenerator { newId(): string }`
  - `const uuidv4IdGenerator: IdGenerator` (uses `crypto.randomUUID()` from Node std lib)
  - `abstract class DomainError extends Error { abstract readonly code: string; toJSON(): { code: string; message: string } }`
  - `class NotFoundError extends DomainError`
  - `class ValidationError extends DomainError`
  - `class ConflictError extends DomainError`
  - `class UnauthorizedError extends DomainError`
  - `class InternalError extends DomainError` (for "should never happen" wrappers — when bubbling up unexpected exceptions)
- **Dependencies:** none (only TypeScript built-ins and `node:crypto`).
- **Reuses:** nothing internal.

### `ports`

- **Purpose:** Declare every cross-cutting interface that domain code and apps depend on. No implementations.
- **Location:** `packages/ports/`
- **Package name:** `@donaoferta/ports`
- **Public interface (exported by `src/index.ts`):**
  - `interface Repository<TEntity, TId>` — `findById(id: TId): Promise<Result<TEntity, NotFoundError>>`, `save(entity: TEntity): Promise<Result<void, DomainError>>`, `delete(id: TId): Promise<Result<void, DomainError>>` (concrete repositories may extend with domain-specific queries)
  - `interface EventBus` — `publish<T>(event: { name: string; payload: T; occurredAt: Date }): Promise<Result<void, DomainError>>`
  - `interface Cache` — `get<T>(key: string): Promise<T | null>`, `set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>`, `delete(key: string): Promise<void>`
  - `interface HttpClient` — `request<TResponse>(input: { method: HttpMethod; url: string; headers?: Record<string, string>; query?: Record<string, string | number>; body?: unknown; timeoutMs?: number }): Promise<Result<{ status: number; headers: Record<string, string>; body: TResponse }, HttpClientError>>` (where `HttpClientError extends DomainError`)
  - `interface SecretStore` — `get(name: string): Promise<Result<string, NotFoundError>>`
- **Dependencies:** `@donaoferta/core-kernel` only.
- **Reuses:** the `Result` and error types from `core-kernel`.

### `http-kit`

- **Purpose:** Shared building blocks for any Hono-based app: app factory, error mapping, request-id, error-handler middleware. **Stateless and not Lambda-specific** — Lambda wiring lands in `infra-terraform-base`.
- **Location:** `packages/http-kit/`
- **Package name:** `@donaoferta/http-kit`
- **Public interface:**
  - `createApp(options: { requestId?: () => string; onError?: (err: unknown) => HttpProblem }): Hono` — returns a Hono instance pre-wired with `requestId` and `errorHandler` middlewares
  - `mapDomainErrorToHttp(err: DomainError): HttpProblem` — table-driven (see Error Handling Strategy below)
  - `type HttpProblem = { status: number; body: { error: { code: string; message: string; requestId?: string } } }`
- **Dependencies:** `hono`, `@donaoferta/core-kernel`, `@donaoferta/ports`.
- **Reuses:** Hono primitives; `DomainError` subclasses from `core-kernel`.

### `apps/api`

- **Purpose:** REST API runtime. In this feature, it exposes only `GET /health`.
- **Location:** `apps/api/`
- **Package name:** `@donaoferta/api`
- **Public interface:** none consumed by other packages. External interface is HTTP.
- **Endpoints in this feature:**
  - `GET /health` → `{ status: "ok", uptimeSeconds: number, version: string }`
  - any other path → `{ error: { code: "NOT_FOUND", message: string, requestId: string } }` with HTTP 404
- **Composition root (`src/compose.ts`):**
  ```ts
  // Pseudocode of the contract — full impl in Execute phase
  export function compose(): { app: Hono } {
    const clock: Clock = systemClock;
    const idGenerator: IdGenerator = uuidv4IdGenerator;
    const app = createApp({ requestId: () => idGenerator.newId() });
    registerHealth(app, { clock, version: APP_VERSION });
    return { app };
  }
  ```
- **Local entry (`src/local.ts`):**
  ```ts
  import { serve } from "@hono/node-server";
  import { compose } from "./compose.js";
  const { app } = compose();
  serve({ fetch: app.fetch, port: 3000 }, ({ port }) => {
    console.log(JSON.stringify({ msg: "api listening", port }));
  });
  ```
- **Dependencies:** `@donaoferta/core-kernel`, `@donaoferta/http-kit`, `@donaoferta/ports`, `hono`, `@hono/node-server`.
- **Reuses:** `createApp` from `http-kit`.

### `tools/check-deps.ts`

- **Purpose:** Static guard (FOUND-17 / FOUND-28) that fails CI when a package violates dependency rules that ESLint cannot easily express (e.g., presence of cloud SDKs in `dependencies` of `ports` or domain packages).
- **Location:** `tools/check-deps.ts`
- **Run:** `pnpm check:deps`
- **Algorithm:** load every `package.json` under `packages/` and `apps/`; for each, lookup the role from a small allowlist (encoded in the script); fail if any disallowed prefix appears in `dependencies` / `devDependencies`.
- **Dependencies:** `tsx`, `glob`. No domain or app coupling.

---

## Data Models

This feature has no domain data. It defines only two HTTP response shapes:

```ts
type HealthResponse = {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  version: string;
};

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};
```

`HealthResponse.status` is `"ok" | "degraded"` because we anticipate later adding dependency probes (see edge case in spec.md); the discriminator is reserved but always `"ok"` in this feature.

---

## Error Handling Strategy

`http-kit` provides the central `mapDomainErrorToHttp` function. The table is the single source of truth for HTTP semantics.

| Error class (from `core-kernel`)                 | HTTP status | Body `error.code`  | When                                                         |
| ------------------------------------------------ | ----------- | ------------------ | ------------------------------------------------------------ |
| `ValidationError`                                | 400         | `VALIDATION_ERROR` | Zod parse failure or business rule rejection at the boundary |
| `UnauthorizedError`                              | 401         | `UNAUTHORIZED`     | Missing/invalid API key (future)                             |
| `NotFoundError`                                  | 404         | `NOT_FOUND`        | Resource not found; also catch-all for unmatched routes      |
| `ConflictError`                                  | 409         | `CONFLICT`         | Duplicate key, optimistic-lock conflict                      |
| `InternalError` or `unknown` (non-`DomainError`) | 500         | `INTERNAL_ERROR`   | Last resort; full error logged, message sanitized in body    |

**Rules:**

- Handlers **never** `try/catch` for HTTP shaping — they let domain errors propagate up to the global Hono `onError` registered by `createApp`.
- Programming errors (assertion failures, type-narrowing failures, impossible branches) **throw** (not `err()`); they become `INTERNAL_ERROR` with a `requestId` for correlation.
- Domain operations that can fail in business-meaningful ways **return `Result.err(...)`**. Handlers convert `Result.err` into a thrown `DomainError` at the HTTP boundary, so the global handler does the formatting. This keeps handlers tiny and consistent.

---

## Architectural Enforcement (FOUND-24 to FOUND-28)

Two complementary mechanisms:

### 1. `eslint-plugin-boundaries` flat config

In `eslint.config.js`, declare element types and rules:

```js
// pseudocode — final form in Execute
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    settings: {
      "boundaries/elements": [
        { type: "core", pattern: "packages/core-kernel/**" },
        { type: "ports", pattern: "packages/ports/**" },
        { type: "kit", pattern: "packages/*-kit/**" },
        { type: "domain", pattern: "packages/{stores,catalog,users,collector,agent}/**" },
        { type: "adapter", pattern: "packages/adapters-*/**" },
        { type: "app", pattern: "apps/*/**" },
      ],
    },
    plugins: { boundaries },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "core", allow: [] },
            { from: "ports", allow: ["core"] },
            { from: "domain", allow: ["core", "ports", "domain"] },
            { from: "kit", allow: ["core", "ports", "kit"] },
            { from: "adapter", allow: ["core", "ports", "adapter"] },
            { from: "app", allow: ["core", "ports", "domain", "kit", "adapter"] },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@aws-sdk/*", "@google-cloud/*", "aws-cdk-lib", "firebase-admin"],
              message:
                "Cloud SDKs are only allowed in packages/adapters-*. Move this import there.",
            },
          ],
        },
      ],
    },
  },
  // The `no-restricted-imports` rule above applies everywhere by default.
  // Override for `packages/adapters-*` to allow cloud SDKs:
  {
    files: ["packages/adapters-*/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];
```

### 2. `tools/check-deps.ts`

ESLint catches _imports_. We additionally guard `package.json` `dependencies`/`devDependencies` so a package can't even declare a forbidden SDK. This catches drift such as someone adding `@aws-sdk/client-dynamodb` to `packages/ports/package.json` without yet importing it. Pseudocode:

```ts
const FORBIDDEN_BY_ROLE: Record<Role, RegExp[]> = {
  core: [/^@aws-sdk\//, /^@google-cloud\//, /^aws-cdk-lib$/, /^firebase-admin$/],
  ports: [/^@aws-sdk\//, /^@google-cloud\//, /^aws-cdk-lib$/, /^firebase-admin$/, /^[^@]/], // ports allow only @donaoferta/*
  domain: [/^@aws-sdk\//, /^@google-cloud\//, /^aws-cdk-lib$/, /^firebase-admin$/],
  kit: [/^@aws-sdk\//, /^@google-cloud\//, /^aws-cdk-lib$/, /^firebase-admin$/],
  adapter: [], // allowed
  app: [], // apps wire concretes; allowed
};
```

Role is read from a per-package field `"donaoferta": { "role": "..." }` in each `package.json`.

---

## Build & Tooling Strategy

| Concern                          | Choice                                                                            | Rationale                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Library build (`packages/*`)** | `tsc -b` with TypeScript project references                                       | Strict typings preserved; emit `.d.ts`; fast incremental; no bundling needed for libs |
| **App build (`apps/*`)**         | `tsup` (esbuild under the hood), ESM single-file output                           | Lambda zip will be one `.mjs` later; dev locally with `tsx watch`                     |
| **Test runner**                  | Vitest with `environment: "node"` and V8 coverage provider                        | Fast TS support; Vitest config inherited via Turborepo cache                          |
| **Lint**                         | ESLint 9 flat config, `typescript-eslint`, `eslint-plugin-boundaries`             | See section above                                                                     |
| **Format**                       | Prettier 3                                                                        | One config at root, no per-package overrides                                          |
| **Package manager**              | pnpm 9 (locked via `packageManager` field in root `package.json`)                 | D-005; `engines.pnpm: ">=9"`                                                          |
| **Node version**                 | `.nvmrc` = `22` and `engines.node: "22.x"`                                        | Lambda `nodejs22.x` target (D-002)                                                    |
| **Task orchestration**           | Turborepo 2 with `tasks` map (build, typecheck, test, lint) and `dependsOn` graph | D-005; caches by file inputs                                                          |
| **Workspace declaration**        | `pnpm-workspace.yaml` listing `apps/*`, `packages/*`                              | Standard pnpm pattern                                                                 |

### Root `turbo.json` (target shape — final in Execute)

```jsonc
{
  "$schema": "https://turborepo.org/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "lint": { "outputs": [] },
    "check:deps": { "outputs": [] },
    "dev": { "cache": false, "persistent": true },
  },
}
```

### Root scripts (target shape)

| Script            | Command                             |
| ----------------- | ----------------------------------- |
| `pnpm build`      | `turbo run build`                   |
| `pnpm typecheck`  | `turbo run typecheck`               |
| `pnpm test`       | `turbo run test`                    |
| `pnpm lint`       | `turbo run lint && pnpm check:deps` |
| `pnpm format`     | `prettier --write .`                |
| `pnpm check:deps` | `tsx tools/check-deps.ts`           |
| `pnpm dev:api`    | `pnpm --filter @donaoferta/api dev` |

---

## Tech Decisions (non-obvious)

| Decision                                                           | Choice                                                 | Rationale                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Result type as free functions, not a class                         | `ok()`, `err()`, `Result.map(...)`                     | Avoids `this`-binding pitfalls; trivially serializable; smaller bundle                 |
| Error model: throw at the HTTP boundary, `Result` inside use-cases | hybrid                                                 | Keeps handlers free of boilerplate while preserving algebraic error handling in domain |
| ESLint flat config (`eslint.config.js`)                            | over legacy `.eslintrc`                                | ESLint 9 deprecates legacy; flat config required for `eslint-plugin-boundaries` v5+    |
| Two enforcement layers (lint + `check-deps.ts`)                    | both                                                   | Lint catches imports; `check-deps` catches `package.json` drift; cheap insurance       |
| `tsc -b` for libs, `tsup` for apps                                 | hybrid                                                 | Best emit fidelity for libs; smallest artifacts for apps that will be Lambda-bundled   |
| `@donaoferta` npm scope                                            | scoped names for every workspace                       | Prevents accidental name collision; intent-revealing imports                           |
| `crypto.randomUUID()` for ids in v1                                | over `nanoid`/ULID                                     | Built-in Node 22; no dependency; switchable later via the `IdGenerator` port           |
| Versioning `0.1.0` for every workspace at bootstrap                | aligned with `v0.1.x` mainline (`git-flow-release.md`) | Conforms to repository governance from day 1                                           |

---

## Git Flow for this Feature (per `.cursor/rules/git-flow-release.md`)

The repository has no commits yet, only untracked files. The bootstrap dance:

1. On `main`, make a single **anchor commit** with the existing governance/spec artifacts already present in the working tree:
   - `.specs/`, `sdd.yml`, `.gitignore`
   - Commit message: `chore(repo): bootstrap governance and SDD artifacts`
2. Create the development mainline `v0.1.x` from `main`. Push.
3. Branch `feat/foundation-monorepo` from `v0.1.x`.
4. Each Execute task (see `tasks.md`) produces **one atomic Conventional Commit** on this branch. Suggested commit scopes (used in the upcoming `tasks.md`):

   | Scope      | Use for                                                                                                       |
   | ---------- | ------------------------------------------------------------------------------------------------------------- |
   | `repo`     | root configs (`package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `.editorconfig`, `.nvmrc`, `README.md`) |
   | `turbo`    | `turbo.json`                                                                                                  |
   | `kernel`   | `packages/core-kernel`                                                                                        |
   | `ports`    | `packages/ports`                                                                                              |
   | `http-kit` | `packages/http-kit`                                                                                           |
   | `api`      | `apps/api`                                                                                                    |
   | `lint`     | `eslint.config.js`, `prettier.config.js`, `tools/lint-rules/`                                                 |
   | `tooling`  | `tools/check-deps.ts`, `tools/tsconfig/*`                                                                     |

5. Open a PR `feat/foundation-monorepo → v0.1.x`. PR description references `FOUND-01..FOUND-28` (P1 only — P2/P3 in follow-up PRs if scope holds).
6. After merge into `v0.1.x`, the M0 milestone proceeds with `infra-terraform-base` and `observability-base` from new branches off `v0.1.x`.

P2 (`FOUND-29..FOUND-33`) and P3 (`FOUND-34..FOUND-35`) decision: include in **same** PR if the implementation cost stays under ~30 minutes of additional work each; otherwise split into `feat/foundation-tsconfig`, `feat/foundation-lint-format`, `feat/foundation-precommit` follow-ups. Recommendation: keep P2 in the same PR (low cost) and split P3 (Husky setup deserves its own justification).

---

## Risks and Open Questions

| Risk                                                                               | Mitigation                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint-plugin-boundaries` v5+ with ESLint 9 flat config may still have edge cases | If config refuses to load, fall back to `no-restricted-imports` with explicit per-package patterns; document in STATE.md if encountered        |
| Turborepo cache misses due to non-deterministic outputs (e.g., `dist/`)            | Pin `tsc` `incremental: true`, explicit `outputs` in `turbo.json`                                                                              |
| Composition-root growing unbounded over time                                       | Documented convention: each new endpoint group has its own `register*(app, deps)` registrar; `compose.ts` only wires deps and calls registrars |
| New contributors confused about role of each package directory                     | `README.md` at the root summarizes the dependency rules table; every package has its own `README.md` of one paragraph explaining its role      |
| Future ESLint rule changes break lint cache in Turborepo                           | Add `eslint.config.js` and `tools/lint-rules/**` to `globalDependencies` so any rule change invalidates lint cache only                        |

**Open question:** none blocking. P-004 (target stores) is unrelated to this feature and remains tracked in STATE.md.

---

## Definition of Done (this feature)

- [ ] All `FOUND-01..FOUND-28` requirements implemented and Verified.
- [ ] `pnpm install && pnpm typecheck && pnpm test && pnpm lint && pnpm build` is green on a clean clone.
- [ ] `pnpm dev:api` followed by `curl -s localhost:3000/health` returns `{"status":"ok","uptimeSeconds":<n>,"version":"0.1.0"}`.
- [ ] Adding a temporary `packages/ports/src/_violation.ts` importing `@aws-sdk/client-dynamodb` causes both `pnpm lint` and `pnpm check:deps` to fail.
- [ ] PR merged into `v0.1.x` with atomic Conventional Commits using the scopes table above.
