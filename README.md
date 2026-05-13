# donaoferta

Serverless Node monorepo for the donaoferta platform (REST API, MCP server, Price Collector, AI Agent).

## Prerequisites

- **Node:** 22.x (LTS) — see [`.nvmrc`](.nvmrc). Local development works on Node ≥ 20.19; production targets Node 22.
- **pnpm:** 9.x — installed automatically via [Corepack](https://nodejs.org/api/corepack.html).

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

## Bootstrap

```bash
git clone <repo>
cd dona
pnpm install
pnpm -w turbo run build typecheck test lint
```

Run the API locally:

```bash
pnpm dev:api
curl -s localhost:3000/health | jq
```

## Repository layout

```
apps/
  api/             # REST API (Hono) — composition root + /health
packages/
  core-kernel/     # Result, Clock, IdGenerator, DomainError (zero deps)
  ports/           # Cross-cutting interfaces (Repository, EventBus, Cache, HttpClient, SecretStore)
  http-kit/        # Hono app factory + middlewares + DomainError → HTTP mapping
tools/
  tsconfig/        # Shared tsconfig presets (base.json, app.json)
  check-deps.ts    # Static guard: forbids cloud SDKs in disallowed roles
  check-tsconfig.ts # Static guard: every workspace tsconfig extends a preset
  lint-rules/      # ESLint config fragments (architectural boundaries)
.specs/            # Spec-Driven Development artifacts (project, features, codebase)
```

## Architectural rules (enforced)

| Layer            | May depend on                              |
| ---------------- | ------------------------------------------ |
| `core-kernel`    | nothing                                    |
| `ports`          | `core-kernel`                              |
| domain packages  | `core-kernel`, `ports`, other domain       |
| kit packages     | `core-kernel`, `ports`, other kits         |
| `adapters-*`     | `core-kernel`, `ports`, other adapters     |
| `apps/*`         | everything except other apps               |

**Cloud SDKs (`@aws-sdk/*`, `@google-cloud/*`, `aws-cdk-lib`, `firebase-admin`) are allowed only inside `packages/adapters-*`.**

Both lint (`pnpm lint`) and the static `pnpm check:deps` script enforce these boundaries — see `.specs/features/foundation-monorepo/design.md`.

## Root scripts

| Script                | What it does                                           |
| --------------------- | ------------------------------------------------------ |
| `pnpm install`        | Install every workspace                                |
| `pnpm build`          | Turborepo: build every workspace                       |
| `pnpm typecheck`      | Turborepo: typecheck every workspace                   |
| `pnpm test`           | Turborepo: run unit tests                              |
| `pnpm lint`           | ESLint + `check:deps` + `check:tsconfig`               |
| `pnpm format`         | Prettier write                                         |
| `pnpm format:check`   | Prettier check                                         |
| `pnpm dev:api`        | Start the API locally on `http://localhost:3000`       |
| `pnpm check:deps`     | Static guard: forbidden dependencies per role          |
| `pnpm check:tsconfig` | Static guard: tsconfig strict presets                  |

## Documentation

- Project vision and tech stack → [`.specs/project/PROJECT.md`](.specs/project/PROJECT.md)
- Roadmap and milestones → [`.specs/project/ROADMAP.md`](.specs/project/ROADMAP.md)
- Persistent decisions and state → [`.specs/project/STATE.md`](.specs/project/STATE.md)
- Foundation feature spec → [`.specs/features/foundation-monorepo/`](.specs/features/foundation-monorepo/)

## License

UNLICENSED — internal project.
