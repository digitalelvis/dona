# foundation-monorepo Tasks

**Design:** [`./design.md`](./design.md)
**Spec:** [`./spec.md`](./spec.md)
**Status:** Draft

---

## Testing Conventions (greenfield — established for this feature)

> `.specs/codebase/TESTING.md` does not exist yet (greenfield repo). The matrix below is the authoritative reference for this feature's tasks. After M0 it will be promoted into `.specs/codebase/TESTING.md`.

### Test Coverage Matrix

| Code layer | Required test type | Rationale | Parallel-safe? |
|---|---|---|---|
| `packages/core-kernel/src/**` (Result, DomainError) | **unit** | Pure functions / classes; trivially testable; foundation for every other package | Yes |
| `packages/ports/src/**` (interfaces only) | **none** (type-check IS the test) | No runtime behavior — only TypeScript types. `tsc --noEmit` validates them | Yes |
| `packages/http-kit/src/**` (error-mapper, middlewares) | **unit** | Pure mapping functions + Hono middleware factories; easily testable via `app.request()` | Yes |
| `apps/api/src/handlers/**` | **unit** (handler-level via `app.request()`) | Fast in-process verification of HTTP shape without booting a server | Yes |
| `tools/check-deps.ts`, `tools/check-tsconfig.ts` | **unit** (run against fixture `package.json` / `tsconfig.json`) | The enforcement scripts ARE the safety net — they must themselves be tested | Yes |
| Root configs (`package.json`, `turbo.json`, `eslint.config.js`, etc.) | **none** (verified by gate commands) | Configs are validated by running the toolchain they configure | Yes |

### Gate Check Commands

| Gate | Command | Use when |
|---|---|---|
| **quick** | `pnpm --filter <workspace> test` | Single workspace was modified |
| **build** | `pnpm -w turbo run build` | Verify a workspace builds (libs emit `dist/`, apps emit bundle) |
| **full** | `pnpm typecheck && pnpm lint && pnpm check:deps && pnpm check:tsconfig && pnpm -w turbo run test && pnpm -w turbo run build` | End-of-task verification; required before declaring task Done |

### Parallelism Assessment

Every test in this feature is in-process Vitest with no shared state, no network, no filesystem mutation outside `os.tmpdir()`. **All test types in this feature are Parallel-Safe.** Therefore `[P]` flags depend only on code dependencies.

---

## Tooling Conventions (MCPs & Skills per task)

| Resource | Available? | Default usage |
|---|---|---|
| **MCP `plugin-atlassian-atlassian`** | Yes | Not applicable to this feature (no Jira/Confluence) → **NONE** in every task |
| **Skill `nodejs-best-practices`** | Yes (`.cursor/skills/nodejs-best-practices/SKILL.md`) | Consult on every task that writes Node/TS code (T2, T6–T13) |
| **Skill `spec-driven`** | Yes | Orchestrating only — not used inside task execution |

If new MCPs are added (e.g., Context7 for live API docs of Hono/Vitest/Turborepo), they become candidates for T6, T8, T9, T12 to verify current APIs.

---

## Execution Plan

### Phase 1 — Git bootstrap (sequential)

```
T1
```

### Phase 2 — Root scaffolding (sequential)

```
T2 → T3
```

### Phase 3 — Build & format tooling (parallel after T3)

```
        ┌→ T4 [P] (turbo.json)
T3 ─────┤
        └→ T5 [P] (prettier)
```

### Phase 4 — Core libraries (sequential dependency chain)

```
T3 → T6 (core-kernel) → T7 (ports) → T8 (http-kit)
```

### Phase 5 — Enforcement layer (parallel after T8)

```
        ┌→ T9  [P] (eslint + boundaries)
T8 ─────┤
        ├→ T10 [P] (check-deps)
        │
        └→ T11 [P] (check-tsconfig)
```

### Phase 6 — Application (sequential after enforcement)

```
T9 + T10 + T11 → T12 (apps/api)
```

### Phase 7 — End-to-end verification (sequential)

```
T12 → T13 (clean-install smoke test + PR readiness)
```

---

## Task Breakdown

### T1: Bootstrap git history and feature branch

**What:** Create the repository's initial anchor commit on `main`, fork `v0.1.x` as the dev mainline, and create `feat/foundation-monorepo` to host every subsequent task.
**Where:** Git refs only. No file content changes beyond what already exists in the working tree (`.specs/`, `sdd.yml`, `.gitignore`).
**Depends on:** None
**Reuses:** Governance rules from `.cursor/rules/git-flow-release.md`
**Requirement:** Process gate (no FOUND-XX directly; enables atomic commits for T2–T13)

**Tools:**

- MCP: NONE
- Skill: NONE

**Done when:**

- [ ] On `main`: a single commit exists with message `chore(repo): bootstrap governance and SDD artifacts`, staging the three pre-existing untracked items (`.specs/`, `sdd.yml`, `.gitignore`)
- [ ] Branch `v0.1.x` exists, pointing at the same commit as `main`
- [ ] Branch `feat/foundation-monorepo` exists, pointing at the same commit as `v0.1.x`
- [ ] Current `HEAD` is `feat/foundation-monorepo`
- [ ] `git status` is clean

**Tests:** none
**Gate:** quick (manual verification — `git log --oneline --decorate -1` shows the anchor commit on all three refs)

**Verify:**

```bash
git log --oneline --decorate -1
git branch --list  # shows main, v0.1.x, feat/foundation-monorepo
git status         # clean working tree
```

**Commit:** `chore(repo): bootstrap governance and SDD artifacts`

---

### T2: Root workspace scaffolding

**What:** Create the root `package.json` (private), `pnpm-workspace.yaml`, the solution-root `tsconfig.json`, plus environment anchors (`.nvmrc`, `.npmrc`, `.editorconfig`) and an extended `.gitignore`. Also a top-level `README.md` documenting the bootstrap commands. After this task `pnpm install` runs successfully even with zero packages.
**Where:**
- `package.json` (root)
- `pnpm-workspace.yaml`
- `tsconfig.json` (solution-root; empty `references` initially)
- `.nvmrc` (`22`)
- `.npmrc` (`enable-pre-post-scripts=true`, `strict-peer-dependencies=true`)
- `.editorconfig`
- `.gitignore` (append `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.turbo/`)
- `README.md` (bootstrap instructions, architecture summary linking to `.specs/`)

**Depends on:** T1
**Reuses:** Layout from `design.md` § "Repository Layout"
**Requirement:** FOUND-01, FOUND-04, FOUND-05

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] Root `package.json` declares `"private": true`, `"packageManager": "pnpm@9.x"`, `"engines": { "node": "22.x", "pnpm": ">=9" }`, and the script placeholders from `design.md` § "Root scripts"
- [ ] `pnpm-workspace.yaml` lists `apps/*` and `packages/*`
- [ ] Root `tsconfig.json` is solution-style with `references: []` (filled progressively by later tasks)
- [ ] `pnpm install` exits 0 with no warnings about misconfiguration
- [ ] `pnpm --version` matches the `packageManager` field
- [ ] Gate check passes: `pnpm install` exits 0

**Tests:** none
**Gate:** quick

**Verify:**

```bash
pnpm install
pnpm -v && node -v
```

**Commit:** `chore(repo): scaffold pnpm workspace and root configuration`

---

### T3: Shared TypeScript configurations

**What:** Create the two shared tsconfig presets — `tools/tsconfig/base.json` (for libraries) and `tools/tsconfig/app.json` (for apps) — both enforcing `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `isolatedModules`, ESM module resolution, and incremental build.
**Where:**
- `tools/tsconfig/base.json`
- `tools/tsconfig/app.json`

**Depends on:** T2
**Reuses:** Strict flags listed in `PROJECT.md` and `design.md` § "Tech Decisions"
**Requirement:** FOUND-03, FOUND-29

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `tools/tsconfig/base.json` enables every flag listed above, sets `composite: true`, `declaration: true`, `declarationMap: true`, `sourceMap: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`, `outDir: "dist"`, `rootDir: "src"`
- [ ] `tools/tsconfig/app.json` extends `base.json` but sets `composite: false`, `declaration: false`, `noEmit: false` and adapts module options for bundling
- [ ] `tsc -p tools/tsconfig/base.json --showConfig` returns valid JSON (smoke test)
- [ ] Gate check passes: `pnpm -w tsc -b` exits 0 (no projects yet, but the command succeeds)

**Tests:** none
**Gate:** quick

**Verify:**

```bash
pnpm -w tsc -b
pnpm -w tsc -p tools/tsconfig/base.json --showConfig | head
```

**Commit:** `chore(tooling): add shared tsconfig presets for libs and apps`

---

### T4: Turborepo configuration [P]

**What:** Add `turbo.json` defining the tasks `build`, `typecheck`, `test`, `lint`, `check:deps`, `check:tsconfig`, and `dev` with the dependency graph and outputs documented in `design.md`. Wire the matching root scripts.
**Where:**
- `turbo.json`
- `package.json` (root — update `scripts` section)

**Depends on:** T3
**Reuses:** `turbo.json` shape from `design.md` § "Root `turbo.json`"
**Requirement:** FOUND-02, FOUND-32

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `turbo.json` matches the design shape, with `tasks.build.outputs = ["dist/**"]`, `tasks.test.outputs = ["coverage/**"]`, `tasks.dev.persistent = true`, `tasks.dev.cache = false`
- [ ] `globalDependencies` includes `tsconfig.json`, `tools/tsconfig/**`, `eslint.config.js`, `prettier.config.js`
- [ ] `pnpm -w turbo run build typecheck test lint` runs to completion (zero packages, but exits 0)
- [ ] Gate check passes: `pnpm -w turbo run build typecheck test` exits 0

**Tests:** none
**Gate:** build

**Verify:**

```bash
pnpm -w turbo run build typecheck test lint --dry=json | jq '.tasks | length'
```

**Commit:** `chore(turbo): configure task graph and outputs`

---

### T5: Prettier configuration [P]

**What:** Add `prettier.config.js` and `.prettierignore`. Wire the root `format` and `format:check` scripts.
**Where:**
- `prettier.config.js`
- `.prettierignore`
- `package.json` (root — append two scripts)

**Depends on:** T3 (only because it must come after the workspace exists; not technically blocked by T4)
**Reuses:** Conventional Prettier defaults (single-line trailing commas, semi true, single quotes)
**Requirement:** FOUND-31, FOUND-32, FOUND-33

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `prettier.config.js` exports a config object with explicit choices documented (no relying on Prettier defaults silently)
- [ ] `.prettierignore` excludes `dist/`, `coverage/`, `node_modules/`, `.turbo/`, `*.tsbuildinfo`, `pnpm-lock.yaml`
- [ ] `pnpm format:check` exits 0 on a freshly formatted repo
- [ ] Gate check passes: `pnpm format:check` exits 0

**Tests:** none
**Gate:** quick

**Verify:**

```bash
pnpm format:check
echo "const x  =  1;" > /tmp/_violation.ts && pnpm prettier --check /tmp/_violation.ts; rm /tmp/_violation.ts
```

**Commit:** `chore(format): add prettier configuration`

---

### T6: `packages/core-kernel`

**What:** Implement the `core-kernel` package end-to-end: `Result<T, E>` and helpers, `Clock` + `systemClock`, `IdGenerator` + `uuidv4IdGenerator`, `DomainError` and its five subclasses (`NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`, `InternalError`). Includes unit tests with 100 % coverage, package.json with `donaoferta.role: "core"`, tsconfig extending `tools/tsconfig/base.json`, and wiring into the root tsconfig `references`.
**Where:**
- `packages/core-kernel/package.json`
- `packages/core-kernel/tsconfig.json`
- `packages/core-kernel/src/result.ts`
- `packages/core-kernel/src/clock.ts`
- `packages/core-kernel/src/id.ts`
- `packages/core-kernel/src/errors.ts`
- `packages/core-kernel/src/index.ts`
- `packages/core-kernel/test/result.test.ts`
- `packages/core-kernel/test/errors.test.ts`
- `tsconfig.json` (root — append reference)

**Depends on:** T3, T4
**Reuses:** Component contract in `design.md` § "core-kernel"
**Requirement:** FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] Public API matches the contract in `design.md` (all symbols exported by `src/index.ts`)
- [ ] `package.json.dependencies` is **absent or empty** (zero runtime deps); `devDependencies` only `vitest`, `@vitest/coverage-v8`, `typescript`, `tsx`
- [ ] `package.json.donaoferta.role = "core"`
- [ ] Unit tests cover every export: `ok`, `err`, `Result.map`, `Result.flatMap`, `Result.isOk`, `Result.isErr`, `Result.unwrap`, `DomainError.toJSON`, each subclass instance check
- [ ] Coverage report shows 100 % lines / 100 % branches for `src/result.ts` and `src/errors.ts`
- [ ] Gate check passes: `pnpm --filter @donaoferta/core-kernel test --coverage` exits 0 with the coverage threshold enforced (100 %)
- [ ] Test count: ≥ 18 tests pass (no silent deletions)
- [ ] `pnpm -w turbo run build --filter=@donaoferta/core-kernel` emits `dist/` with `.js`, `.js.map`, `.d.ts`, `.d.ts.map`

**Tests:** unit
**Gate:** full

**Verify:**

```bash
pnpm --filter @donaoferta/core-kernel test --coverage
pnpm -w turbo run build --filter=@donaoferta/core-kernel
ls packages/core-kernel/dist | head
```

**Commit:** `feat(kernel): add core-kernel primitives (Result, Clock, Id, errors)`

---

### T7: `packages/ports`

**What:** Implement the `ports` package as type-only interfaces (`Repository`, `EventBus`, `Cache`, `HttpClient`, `SecretStore`, plus `HttpClientError` and `HttpMethod` helpers). No runtime code, no tests beyond `tsc --noEmit` validation. `donaoferta.role: "ports"`.
**Where:**
- `packages/ports/package.json`
- `packages/ports/tsconfig.json`
- `packages/ports/src/repository.ts`
- `packages/ports/src/event-bus.ts`
- `packages/ports/src/cache.ts`
- `packages/ports/src/http-client.ts`
- `packages/ports/src/secret-store.ts`
- `packages/ports/src/index.ts`
- `tsconfig.json` (root — append reference)

**Depends on:** T6
**Reuses:** Component contract in `design.md` § "ports"
**Requirement:** FOUND-12, FOUND-13, FOUND-14, FOUND-15, FOUND-16, FOUND-17

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `package.json.dependencies` lists only `@donaoferta/core-kernel` (workspace protocol `workspace:*`)
- [ ] `package.json.donaoferta.role = "ports"`
- [ ] No file under `src/` contains `import` statements outside `@donaoferta/core-kernel` and TS built-ins
- [ ] Every interface from `design.md` § "ports" is exported by `src/index.ts`
- [ ] Gate check passes: `pnpm -w turbo run typecheck --filter=@donaoferta/ports` exits 0
- [ ] Gate check passes: `pnpm -w turbo run build --filter=@donaoferta/ports` exits 0 and `dist/` contains `.d.ts` files
- [ ] Test count: 0 tests required (per coverage matrix; type-check is the validation)

**Tests:** none
**Gate:** build

**Verify:**

```bash
pnpm -w turbo run typecheck build --filter=@donaoferta/ports
ls packages/ports/dist
```

**Commit:** `feat(ports): add cross-cutting port interfaces`

---

### T8: `packages/http-kit`

**What:** Implement `http-kit`: `createApp({ requestId, onError })` factory, `mapDomainErrorToHttp(err)` table-driven mapper, `request-id` middleware, `error-handler` middleware. Unit tests for `mapDomainErrorToHttp` and the middlewares using `app.request()`.
**Where:**
- `packages/http-kit/package.json`
- `packages/http-kit/tsconfig.json`
- `packages/http-kit/src/app-factory.ts`
- `packages/http-kit/src/error-mapper.ts`
- `packages/http-kit/src/middlewares/request-id.ts`
- `packages/http-kit/src/middlewares/error-handler.ts`
- `packages/http-kit/src/index.ts`
- `packages/http-kit/test/error-mapper.test.ts`
- `packages/http-kit/test/middlewares.test.ts`
- `tsconfig.json` (root — append reference)

**Depends on:** T7
**Reuses:** Component contract in `design.md` § "http-kit"; `DomainError` subclasses from T6; ports from T7 (only types if used)
**Requirement:** FOUND-04 (new package picked up automatically), FOUND-22 (apps will build against this), and supports FOUND-19 (404 shape)

**Tools:**

- MCP: NONE (consider Context7 to verify current Hono API if added later)
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `package.json.dependencies` lists exactly `hono`, `@donaoferta/core-kernel`, `@donaoferta/ports`
- [ ] `package.json.donaoferta.role = "kit"`
- [ ] `mapDomainErrorToHttp` covers all five `DomainError` subclasses + unknown fallback (exhaustive switch, no `default` swallowing)
- [ ] `request-id` middleware injects `c.set("requestId", ...)` and `X-Request-Id` response header
- [ ] `error-handler` middleware converts thrown `DomainError` into the table response, and unknown errors into 500 with sanitized message
- [ ] Tests exercise each row of the error table + the unknown-error path
- [ ] Gate check passes: `pnpm --filter @donaoferta/http-kit test` exits 0
- [ ] Test count: ≥ 8 tests pass (5 error classes + unknown + 2 middleware tests; no silent deletions)
- [ ] `pnpm -w turbo run build --filter=@donaoferta/http-kit` succeeds

**Tests:** unit
**Gate:** full

**Verify:**

```bash
pnpm --filter @donaoferta/http-kit test
pnpm -w turbo run build --filter=@donaoferta/http-kit
```

**Commit:** `feat(http-kit): add Hono app factory, request-id and error-handler middlewares`

---

### T9: ESLint flat config with boundary rules [P]

**What:** Add `eslint.config.js` (flat) with `typescript-eslint`, `eslint-plugin-boundaries`, and `no-restricted-imports`. Configure the six element types (`core`, `ports`, `domain`, `kit`, `adapter`, `app`) by directory pattern and the dependency-rule matrix from `design.md`. Wire the per-workspace `lint` script via Turborepo `lint` task.
**Where:**
- `eslint.config.js`
- `tools/lint-rules/boundaries.js` (extracted config fragment for clarity)
- `package.json` (root — `lint` script in scripts)
- one workspace example: add a `lint` script to `packages/core-kernel/package.json`, `packages/ports/package.json`, `packages/http-kit/package.json` that runs `eslint src test`

**Depends on:** T8
**Reuses:** Enforcement shape in `design.md` § "Architectural Enforcement"
**Requirement:** FOUND-24, FOUND-25, FOUND-26, FOUND-27, FOUND-28

**Tools:**

- MCP: NONE (Context7 for current `eslint-plugin-boundaries` v5+ API if added later)
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `pnpm lint` exits 0 on the clean tree
- [ ] Temporary violation test: creating `packages/ports/src/_violation.ts` containing `import { DynamoDBClient } from "@aws-sdk/client-dynamodb"` makes `pnpm lint` exit non-zero with a clear message identifying the file and the rule
- [ ] Reverse violation test: a file under `packages/core-kernel/src/` importing from `@donaoferta/ports` (or any non-core package) fails lint with `boundaries/element-types`
- [ ] After removing the violation file, `pnpm lint` returns 0 again
- [ ] Gate check passes: `pnpm lint` exits 0
- [ ] Test count: 0 explicit Vitest tests required; the two violation scenarios above are the validation (documented in the task verification)

**Tests:** none (validated by violation scenarios executed at task closure)
**Gate:** full

**Verify:**

```bash
pnpm lint
# Violation test:
cat > packages/ports/src/_violation.ts <<'EOF'
import type {} from "@aws-sdk/client-dynamodb";
EOF
pnpm lint && echo "BUG: lint should have failed" || echo "OK: lint failed as expected"
rm packages/ports/src/_violation.ts
pnpm lint  # should be green again
```

**Commit:** `chore(lint): configure eslint flat config with architectural boundaries`

---

### T10: `tools/check-deps.ts` — package.json dependency guard [P]

**What:** Implement the static script that loads every workspace `package.json`, reads its `donaoferta.role`, and fails if any forbidden dependency pattern is declared. Unit-test it against fixture `package.json` shapes (good + violating).
**Where:**
- `tools/check-deps.ts`
- `tools/check-deps.test.ts`
- `tools/fixtures/` (small JSON fixtures)
- `package.json` (root — `check:deps` script: `tsx tools/check-deps.ts`)
- `turbo.json` (already declared in T4; just confirm)

**Depends on:** T8 (needs at least 3 packages to validate against)
**Reuses:** Algorithm in `design.md` § "Architectural Enforcement" §2
**Requirement:** FOUND-17 (static check on ports), FOUND-28 (single source of truth in `tools/lint-rules/` and `tools/`)

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `pnpm check:deps` exits 0 on the clean tree
- [ ] Fixture test: a fixture `package.json` with role `ports` and `dependencies: { "@aws-sdk/client-dynamodb": "*" }` causes the script (when pointed at fixtures) to exit non-zero with a precise error
- [ ] Fixture test: a fixture `package.json` with role `adapter` and the same dependency exits 0
- [ ] The script's CLI accepts an optional `--root <path>` so tests can target the fixtures dir
- [ ] Gate check passes: `pnpm check:deps && pnpm --filter ./tools test`
- [ ] Test count: ≥ 4 tests (good role × valid, good role × forbidden, adapter × allowed, missing role × error)

**Tests:** unit
**Gate:** full

**Verify:**

```bash
pnpm check:deps
pnpm exec vitest run tools/check-deps.test.ts
```

**Commit:** `chore(tooling): add check-deps script enforcing package.json boundaries`

---

### T11: `tools/check-tsconfig.ts` — tsconfig presets guard [P]

**What:** Implement a static script that verifies every workspace `tsconfig.json` extends `tools/tsconfig/base.json` (libs) or `tools/tsconfig/app.json` (apps), and does not override any strict flag downward. Unit-tested with fixtures.
**Where:**
- `tools/check-tsconfig.ts`
- `tools/check-tsconfig.test.ts`
- `tools/fixtures/tsconfig/` (good + violating fixtures)
- `package.json` (root — `check:tsconfig` script: `tsx tools/check-tsconfig.ts`)

**Depends on:** T8 (needs concrete tsconfigs in workspaces)
**Reuses:** Strict-flag list from T3
**Requirement:** FOUND-30

**Tools:**

- MCP: NONE
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `pnpm check:tsconfig` exits 0 on the clean tree
- [ ] Fixture test: a fixture tsconfig that sets `strict: false` exits non-zero
- [ ] Fixture test: a fixture tsconfig that doesn't extend any preset exits non-zero
- [ ] Fixture test: a fixture tsconfig extending `base.json` with no overrides exits 0
- [ ] Gate check passes: `pnpm check:tsconfig && pnpm exec vitest run tools/check-tsconfig.test.ts`
- [ ] Test count: ≥ 3 tests pass

**Tests:** unit
**Gate:** full

**Verify:**

```bash
pnpm check:tsconfig
pnpm exec vitest run tools/check-tsconfig.test.ts
```

**Commit:** `chore(tooling): add check-tsconfig script enforcing strict presets`

---

### T12: `apps/api` with `GET /health`

**What:** Implement `apps/api` end-to-end: composition root (`compose.ts`), Hono app factory wrapper (`http/app.ts`), error handler wiring (`http/errors.ts`), `/health` handler, local Node server entry (`local.ts`), version constant (`version.ts`), `tsup.config.ts` for ESM single-file build, package.json with `donaoferta.role: "app"`, tsconfig extending `tools/tsconfig/app.json`, unit test for the health handler via `app.request()`.
**Where:**
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/tsup.config.ts`
- `apps/api/src/compose.ts`
- `apps/api/src/version.ts`
- `apps/api/src/local.ts`
- `apps/api/src/http/app.ts`
- `apps/api/src/http/errors.ts`
- `apps/api/src/handlers/health.ts`
- `apps/api/test/health.test.ts`
- `tsconfig.json` (root — append reference)

**Depends on:** T9, T10, T11
**Reuses:** `createApp` and middlewares from `http-kit` (T8); `systemClock`, `uuidv4IdGenerator`, `NotFoundError` from `core-kernel` (T6)
**Requirement:** FOUND-18, FOUND-19, FOUND-20, FOUND-21, FOUND-22, FOUND-23

**Tools:**

- MCP: NONE (Context7 for Hono `aws-lambda` types — though not used in this feature, the contract should be future-friendly)
- Skill: `nodejs-best-practices`

**Done when:**

- [ ] `pnpm dev:api` starts Hono on port 3000 and logs `{"msg":"api listening","port":3000}` as structured JSON
- [ ] `curl -s localhost:3000/health` returns HTTP 200 with body `{"status":"ok","uptimeSeconds":<n>,"version":"0.1.0"}` and a `X-Request-Id` header
- [ ] `curl -s -o /dev/null -w "%{http_code}" localhost:3000/anything-else` returns `404` and the body matches `{"error":{"code":"NOT_FOUND","message":"...","requestId":"..."}}`
- [ ] Unit test for the health handler uses `app.request("/health")` from `compose()` with a stub `Clock` returning a fixed `uptimeSeconds`
- [ ] `pnpm -w turbo run build --filter=@donaoferta/api` emits a single bundled `dist/local.mjs` runnable via `node dist/local.mjs`
- [ ] Gate check passes: `pnpm --filter @donaoferta/api test && pnpm -w turbo run build --filter=@donaoferta/api`
- [ ] Test count: ≥ 3 tests pass (200 path, 404 path, version present)

**Tests:** unit
**Gate:** full

**Verify:**

```bash
pnpm --filter @donaoferta/api test
pnpm -w turbo run build --filter=@donaoferta/api
node apps/api/dist/local.mjs &
sleep 1
curl -s localhost:3000/health | jq
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/nope
kill %1
```

**Commit:** `feat(api): add apps/api with composition root and /health endpoint`

---

### T13: Clean-install smoke test and PR readiness

**What:** Validate the Definition of Done from `design.md` and `spec.md` § "Success Criteria" by running the feature's full gate from a clean state. This task produces no source code — it produces the verification log and the PR.
**Where:** No files created. The output is captured in the PR description.
**Depends on:** T12
**Reuses:** Gate commands from this file's § "Gate Check Commands"
**Requirement:** Validates all FOUND-01..FOUND-33 implemented in prior tasks (FOUND-34..FOUND-35 deferred — P3 not included per design)

**Tools:**

- MCP: NONE
- Skill: NONE

**Done when:**

- [ ] `git clean -fdx` followed by `pnpm install && pnpm typecheck && pnpm lint && pnpm check:deps && pnpm check:tsconfig && pnpm -w turbo run test && pnpm -w turbo run build` is green end-to-end
- [ ] Manual: `pnpm dev:api` + curl smoke test from `apps/api` task is reproducible
- [ ] PR opened `feat/foundation-monorepo → v0.1.x` with body referencing FOUND IDs 01–33 and the verification log
- [ ] PR description lists every commit (one per task T2–T12) in order, confirming atomic Conventional Commits
- [ ] Test count global: total ≥ 33 Vitest tests pass across all workspaces (≥18 kernel + 0 ports + ≥8 http-kit + ≥4 check-deps + ≥3 check-tsconfig + ≥3 api)

**Tests:** none (this task IS the verification)
**Gate:** full

**Verify:**

```bash
# In a separate working copy or after committing all WIP:
git clean -fdx -e .specs -e .cursor -e sdd.yml
pnpm install
pnpm typecheck && pnpm lint && pnpm check:deps && pnpm check:tsconfig
pnpm -w turbo run test && pnpm -w turbo run build
pnpm dev:api &
sleep 2
curl -fs localhost:3000/health | jq
kill %1
```

**Commit:** none (the verification log goes into the PR description, not a commit)

---

## Parallel Execution Map

```
Phase 1 (Sequential):                       Phase 2 (Sequential):
  T1                                          T1 → T2 → T3

Phase 3 (Parallel after T3):                Phase 4 (Sequential dependency chain):
        ┌── T4 [P]                            T3 → T6 → T7 → T8
  T3 ───┤
        └── T5 [P]

Phase 5 (Parallel after T8):                Phase 6 (Sequential after enforcement):
        ┌── T9  [P]                            T9 + T10 + T11 → T12
  T8 ───┼── T10 [P]
        └── T11 [P]                         Phase 7 (Sequential):
                                              T12 → T13
```

**Parallelism constraints honored:**

- T4 ([P]) and T5 ([P]) share only the root `package.json` `scripts` section. They must be **rebased/merged serially** if both modify it; otherwise they touch disjoint files. Recommendation: execute as a single batch updating the root package.json once at the end of Phase 3.
- T9 / T10 / T11 ([P]) touch disjoint paths (`eslint.config.js` + `tools/lint-rules/` vs. `tools/check-deps.*` vs. `tools/check-tsconfig.*`). The `package.json` `scripts` for `check:deps` and `check:tsconfig` are added independently. Safe to parallelize fully.
- All test types in this feature are Vitest in-process — parallel-safe per the matrix.

---

## Validation Tables (mandatory pre-approval checks)

### Check 1 — Task Granularity

| Task | Scope | Status |
|---|---|---|
| T1: Git bootstrap | 3 git refs, 1 commit | ✅ Granular |
| T2: Root scaffolding | 8 root files | ✅ Cohesive (all root-level configs; splitting further would create cross-cutting churn) |
| T3: Shared tsconfigs | 2 preset files | ✅ Granular |
| T4: Turborepo config | 1 config + script wiring | ✅ Granular |
| T5: Prettier config | 1 config + 1 ignore | ✅ Granular |
| T6: core-kernel | 1 package (5 src + 2 test) | ✅ Cohesive (single bounded context, 100 % coverage requirement keeps it atomic) |
| T7: ports | 1 package (6 src, type-only) | ✅ Cohesive |
| T8: http-kit | 1 package (5 src + 2 test) | ✅ Cohesive |
| T9: ESLint config | 1 config + 1 fragment | ✅ Granular |
| T10: check-deps | 1 script + 1 test + fixtures | ✅ Granular |
| T11: check-tsconfig | 1 script + 1 test + fixtures | ✅ Granular |
| T12: apps/api | 1 app | ✅ Cohesive (composition root is the smallest end-to-end demonstrable unit) |
| T13: Smoke test + PR | 0 files | ✅ Verification only |

All ✅. No restructuring needed.

### Check 2 — Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | (none) | (none) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 [P] | T3 | T3 → T4 | ✅ Match |
| T5 [P] | T3 | T3 → T5 | ✅ Match |
| T6 | T3, T4 | T3 → T6 (note: T6 also implicitly needs T4 for `turbo run build`, captured via the linear arrow `T3 → T6` after Phase 3) | ✅ Match (note explained) |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 [P] | T8 | T8 → T9 | ✅ Match |
| T10 [P] | T8 | T8 → T10 | ✅ Match |
| T11 [P] | T8 | T8 → T11 | ✅ Match |
| T12 | T9, T10, T11 | T9 + T10 + T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |

All ✅.

### Check 3 — Test Co-location Validation

| Task | Code layer created | Matrix requires | Task says | Status |
|---|---|---|---|---|
| T1 | git refs only | none | none | ✅ OK |
| T2 | root configs | none | none | ✅ OK |
| T3 | tsconfig presets | none | none | ✅ OK |
| T4 | turbo config | none | none | ✅ OK |
| T5 | prettier config | none | none | ✅ OK |
| T6 | core-kernel runtime | **unit** + 100 % coverage | unit | ✅ OK |
| T7 | ports (types only) | none | none | ✅ OK |
| T8 | http-kit (runtime) | **unit** | unit | ✅ OK |
| T9 | eslint config | none (validated by violation scenario) | none | ✅ OK |
| T10 | tools/check-deps.ts | **unit** | unit | ✅ OK |
| T11 | tools/check-tsconfig.ts | **unit** | unit | ✅ OK |
| T12 | apps/api handlers + composition | **unit** | unit | ✅ OK |
| T13 | (verification only) | none | none | ✅ OK |

All ✅. No deferred-tests anti-pattern.

---

## Resolved Execution Questions

User-confirmed on 2026-05-13 (chat):

1. **Coverage threshold for T6** ✅ — Enforce 100 % at the V8 coverage reporter level. T6 fails if coverage drops below 100 % for `src/result.ts` and `src/errors.ts`.
2. **Husky / pre-commit hook (FOUND-34, FOUND-35)** ✅ — NOT in this feature's PR. Separate PR after `foundation-monorepo` merges into `v0.1.x`.
3. **Hono version pin** ✅ — Implementer pins the latest stable `4.x` at the time T8 executes. Lock the version explicitly in `packages/http-kit/package.json` (no `^` caret allowed for `hono` itself; pin to exact version).
4. **`@donaoferta` npm scope** ✅ — Packages are private to the monorepo (`"private": true` per `package.json`). No `npm publish` planned in v1.
