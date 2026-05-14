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

## AWS deployment setup

Infrastructure lives under [`infra/terraform/`](infra/terraform/). Region is **`us-east-1`**; Terraform **`~> 1.10`**. OIDC trust in [`infra/terraform/stacks/shared/main.tf`](infra/terraform/stacks/shared/main.tf) targets repository **`digitalelvis/dona`** — fork/adapt the `repo:…` subjects if you use another remote.

### 1. Bootstrap remote state (once per AWS account)

Creates the versioned S3 bucket `donaoferta-tfstate-<account_id>` and DynamoDB table `donaoferta-tf-locks` for locks. This stack uses **local** Terraform state (see [`infra/terraform/bootstrap/README.md`](infra/terraform/bootstrap/README.md)).

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

Note the outputs `tfstate_bucket_name` and `tf_locks_table_name`.

### 2. Configure backend partials

Files under `infra/terraform/stacks/api/backends/*.hcl` and the shared example [`infra/terraform/stacks/shared/backend.hcl.example`](infra/terraform/stacks/shared/backend.hcl.example) ship with placeholder account id **`111111111111`**. Replace that segment with your **12-digit AWS account id** everywhere (same value as in the bootstrap bucket name).

For the shared stack, copy the example to a local (gitignored) `backend.hcl` next to `main.tf`, adjust `bucket`, then:

```bash
cd infra/terraform/stacks/shared
terraform init -backend-config=backend.hcl
terraform apply
```

If the account already has an IAM OIDC provider for `token.actions.githubusercontent.com`, pass `-var='existing_github_oidc_provider_arn=arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com'` (or set it in a `*.tfvars` file) so Terraform does not try to create a duplicate.

Record the outputs `role_arns` and `oidc_provider_arn`.

### 3. GitHub Actions repository variables

In GitHub: **Settings → Secrets and variables → Actions → Variables** (repository variables, not secrets):

| Variable | Value |
| -------- | ----- |
| `GHA_STAGING_ROLE_ARN` | ARN of IAM role `donaoferta-gha-staging` (from `role_arns.staging`) |
| `GHA_PROD_ROLE_ARN` | ARN of IAM role `donaoferta-gha-prod` (from `role_arns.prod`) |

Workflows authenticate with OIDC (`permissions: id-token: write`); do **not** store long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in the repo.

### 4. What runs automatically

| Workflow | Trigger | AWS role | Effect |
| -------- | ------- | -------- | ------ |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | PRs targeting `v0.1.x` or `main` | `GHA_STAGING_ROLE_ARN` | Lint/test/build + `terraform plan` for **staging** (`infra/terraform/stacks/api`) |
| [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml) | Push to branches matching `v*.x` (e.g. `v0.1.x`) | `GHA_STAGING_ROLE_ARN` | Build + `terraform apply` **staging** |
| [`.github/workflows/deploy-prod.yml`](.github/workflows/deploy-prod.yml) | Push to `main` | `GHA_PROD_ROLE_ARN` | Build + `terraform apply` **prod** |

`dev` is **manual only** (no deploy workflow): build the API bundle, then apply from `infra/terraform/stacks/api` using `backends/dev.hcl` and `envs/dev.tfvars`.

### 5. Manual apply pattern (example: `dev`)

```bash
pnpm -w turbo run build --filter=@donaoferta/api
cd infra/terraform/stacks/api
terraform init -backend-config=backends/dev.hcl
terraform apply -var-file=envs/dev.tfvars
```

Smoke test: `curl -s "$(terraform output -raw invoke_url)health"`.

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

| Layer           | May depend on                          |
| --------------- | -------------------------------------- |
| `core-kernel`   | nothing                                |
| `ports`         | `core-kernel`                          |
| domain packages | `core-kernel`, `ports`, other domain   |
| kit packages    | `core-kernel`, `ports`, other kits     |
| `adapters-*`    | `core-kernel`, `ports`, other adapters |
| `apps/*`        | everything except other apps           |

**Cloud SDKs (`@aws-sdk/*`, `@google-cloud/*`, `aws-cdk-lib`, `firebase-admin`) are allowed only inside `packages/adapters-*`.**

Both lint (`pnpm lint`) and the static `pnpm check:deps` script enforce these boundaries — see `.specs/features/foundation-monorepo/design.md`.

## Root scripts

| Script                | What it does                                     |
| --------------------- | ------------------------------------------------ |
| `pnpm install`        | Install every workspace                          |
| `pnpm build`          | Turborepo: build every workspace                 |
| `pnpm typecheck`      | Turborepo: typecheck every workspace             |
| `pnpm test`           | Turborepo: run unit tests                        |
| `pnpm lint`           | ESLint + `check:deps` + `check:tsconfig`         |
| `pnpm format`         | Prettier write                                   |
| `pnpm format:check`   | Prettier check                                   |
| `pnpm dev:api`        | Start the API locally on `http://localhost:3000` |
| `pnpm check:deps`     | Static guard: forbidden dependencies per role    |
| `pnpm check:tsconfig` | Static guard: tsconfig strict presets            |

## Documentation

- Project vision and tech stack → [`.specs/project/PROJECT.md`](.specs/project/PROJECT.md)
- Roadmap and milestones → [`.specs/project/ROADMAP.md`](.specs/project/ROADMAP.md)
- Persistent decisions and state → [`.specs/project/STATE.md`](.specs/project/STATE.md)
- Foundation feature spec → [`.specs/features/foundation-monorepo/`](.specs/features/foundation-monorepo/)

## License

UNLICENSED — internal project.
