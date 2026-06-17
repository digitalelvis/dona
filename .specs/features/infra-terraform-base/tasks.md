# infra-terraform-base Tasks

**Design:** [`./design.md`](./design.md)
**Spec:** [`./spec.md`](./spec.md)
**Status:** Done — repo implementation complete (TI1–TI9b ✅). Operator verification (TI10 checklist: apply, smoke, CI PR, branch rules) remains when cutting releases; superseded for *new* work by **`observability-base`** (ADOT + logs).

---

## Progress snapshot (repo state)

| Phase | Tasks | Repo |
| --- | --- | --- |
| TypeScript | TI1 | `apps/api` handler + tsup + Vitest (7 tests) ✅ |
| Bootstrap | TI2 | `infra/terraform/bootstrap/` ✅ |
| Modules | TI3–TI5 | `lambda-fn`, `http-api`, `iam-policy` ✅ |
| Stacks | TI6–TI7 | `stacks/shared`, `stacks/api` + `envs/` + `backends/` ✅ |
| CI/CD | TI8–TI9b | `ci.yml`, `deploy-staging.yml`, `deploy-prod.yml` ✅ |
| E2E | TI10 | ⏳ Operator checklist (below) — run per account, env, and PR |

## Next steps (TI10 — operator checklist)

1. **Bootstrap:** `cd infra/terraform/bootstrap && terraform init && terraform apply` (once per account).
2. **Shared:** `cd infra/terraform/stacks/shared` — copy `backend.hcl.example` → `backend.hcl`, `terraform init -backend-config=backend.hcl`, `terraform apply`.
3. **GitHub repo variables:** Settings → Variables → `GHA_STAGING_ROLE_ARN`, `GHA_PROD_ROLE_ARN` from `terraform output` on `shared` (no separate repo variable for **dev** — dev deploy is manual with your AWS credentials).
4. **Build artefact:** `pnpm -w turbo run build` so `apps/api/dist/handler.mjs` exists before any `api` apply. *(Repo gate: `pnpm -w turbo run build --filter=@donaoferta/api` + `pnpm --filter @donaoferta/api test`.)*
5. **API stacks:** per env: `cd infra/terraform/stacks/api` → `terraform init -backend-config=backends/<env>.hcl` → `terraform apply -var-file=envs/<env>.tfvars` (or let `deploy-staging` / `deploy-prod` apply after merge). Ensure `backends/*.hcl` bucket matches your account (replace `111111111111` placeholder).
6. **Smoke:** `curl "$(terraform output -raw invoke_url)/health"` for dev + staging (expect `200`, JSON with `"status":"ok"`, optional `"traceId"` once `observability-base` ships).
7. **CI proof:** open PR to `v0.1.x` or `main` → `CI` job green (incl. `terraform plan` staging).
8. **GitHub Branch Rulesets:** Follow `design.md` → "Operation — M0: manual GitHub Settings". Create ruleset `release-branches-governance` targeting `~DEFAULT_BRANCH` + `refs/heads/v*.*.x` with rules: require PR, required status check `CI / validate`, block force push, restrict deletions. Verify: open a draft PR against `v0.1.x` and confirm the merge button is disabled until `CI / validate` passes (INFRA-29–33).
9. **PR:** `feat/infra-terraform-base → v0.1.x` with verification notes + invoke URLs (when ready).

---

## Testing Conventions

> Extending the matrix established in `foundation-monorepo` (no `.specs/codebase/TESTING.md` yet).

### Test Coverage Matrix

| Code layer | Required test type | Rationale | Parallel-safe? |
|---|---|---|---|
| `apps/api/src/handler.ts` | **unit** | Lambda handler is a pure function over a mocked app; testable without deploying | Yes |
| `infra/terraform/bootstrap/` | **none** (terraform validate + plan) | IaC — correctness validated by `terraform validate`; idempotence by re-apply | Yes |
| `infra/terraform/modules/*` | **none** (terraform validate) | Module schema validated by `terraform validate` per module | Yes |
| `infra/terraform/stacks/*` | **none** (terraform plan in CI) | Live plan against AWS is the gate for stacks | Yes |
| `.github/workflows/*.yml` | **none** (manual / GH Actions run) | CI pipeline validated by opening a real PR | N/A |

### Gate Check Commands

| Gate | Command | Use when |
|---|---|---|
| **quick** | `pnpm --filter @donaoferta/api test` | After TI1 (handler unit test) |
| **tf-validate** | `terraform validate` | After each Terraform module/stack is written |
| **tf-plan** | `terraform init && terraform plan` (in stack dir) | Before apply — requires AWS credentials |
| **full** | `pnpm typecheck && pnpm lint && pnpm check:deps && pnpm check:tsconfig && pnpm -w turbo run test && pnpm -w turbo run build` | End-of-feature gate (TI10) |

---

## Execution Plan

> Updated section is at the bottom of this file (after the Task Breakdown) with the correct phase names post multi-env expansion.

---

## Task Breakdown

### TI1: Lambda handler entry-point for `apps/api`

**What:** Add `src/handler.ts` (Hono Lambda adapter), update `tsup.config.ts` to emit `dist/handler.mjs` as a second entry-point, add `@types/aws-lambda` dev dependency, and write `test/handler.test.ts`.
**Where:**
- `apps/api/src/handler.ts` — NEW
- `apps/api/tsup.config.ts` — update `entry`
- `apps/api/package.json` — add `@types/aws-lambda` to devDependencies
- `apps/api/test/handler.test.ts` — NEW unit test

**Depends on:** None (TypeScript only, no infra)
**Reuses:** `compose()` from `apps/api/src/compose.ts`; `hono/aws-lambda` already available via `hono` in `packages/http-kit`
**Requirement:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05

**Done when:**

- [x] `apps/api/src/handler.ts` builds app via `compose()`, exports `handler = handle(app)` (same root as local server)
- [x] `tsup.config.ts` entry array includes both `src/local.ts` and `src/handler.ts`
- [x] `pnpm -w turbo run build --filter=@donaoferta/api` emits `dist/handler.mjs` alongside `dist/local.mjs`
- [x] `test/handler.test.ts` constructs a minimal API Gateway HTTP API v2 event, calls `handler(event, context)`, asserts `statusCode === 200` and body contains `"status":"ok"`
- [x] Gate check: `pnpm --filter @donaoferta/api test` exits 0 with ≥ 7 tests (handler + health + app routes)

**Tests:** unit
**Gate:** quick

**Commit:** `feat(api): add Lambda handler entry-point via hono/aws-lambda`

---

### TI2: Terraform bootstrap — remote state S3 + DynamoDB

**What:** Create `infra/terraform/bootstrap/` with the S3 bucket (versioning, SSE, public-access block) and DynamoDB table for state locking. This stack is applied once manually; it has no remote backend itself (local state only, committed to git).
**Where:**
- `infra/terraform/bootstrap/main.tf` — S3 bucket + DynamoDB table resources
- `infra/terraform/bootstrap/outputs.tf` — bucket name, table name
- `infra/terraform/bootstrap/versions.tf` — `required_version = "~> 1.10"`, AWS provider `~> 5.0`
- `infra/terraform/bootstrap/README.md` — one-time apply instructions

**Depends on:** TI1 (branch exists; no code dependency)
**Requirement:** INFRA-06, INFRA-07, INFRA-08, INFRA-09

**Done when:**

- [x] `main.tf` defines `aws_s3_bucket` with name `"donaoferta-tfstate-${data.aws_caller_identity.current.account_id}"`
- [x] Bucket has `aws_s3_bucket_versioning` (enabled), `aws_s3_bucket_server_side_encryption_configuration` (AES256), `aws_s3_bucket_public_access_block` (all true)
- [x] `main.tf` defines `aws_dynamodb_table` `"donaoferta-tf-locks"` with `billing_mode = "PAY_PER_REQUEST"` and `hash_key = "LockID"` (string)
- [x] All resources tagged `project = "donaoferta"`, `managed_by = "terraform"`
- [x] `terraform validate` in `bootstrap/` exits 0
- [x] `README.md` documents the one-time apply command with `--target` for each resource

**Tests:** none (terraform validate)
**Gate:** tf-validate

**Commit:** `chore(infra): add Terraform bootstrap for remote state (S3 + DynamoDB)`

---

### TI3: Terraform module `lambda-fn` [P]

**What:** Create the reusable `modules/lambda-fn` Terraform module. The module creates a Lambda function with a dedicated execution role (`AWSLambdaBasicExecutionRole`), configurable memory/timeout/env/layers.
**Where:**
- `infra/terraform/modules/lambda-fn/main.tf`
- `infra/terraform/modules/lambda-fn/variables.tf`
- `infra/terraform/modules/lambda-fn/outputs.tf`

**Depends on:** TI2 (directory structure established)
**Requirement:** INFRA-10, INFRA-13

**Done when:**

- [x] `variables.tf` declares all variables from design.md § "modules/lambda-fn"
- [x] `main.tf` creates `aws_iam_role` (basic Lambda execution role), `aws_iam_role_policy_attachment` (AWSLambdaBasicExecutionRole), `aws_lambda_function`
- [x] All resources include `tags = merge(var.tags, { project = "donaoferta", environment = var.environment })` — add `environment` variable
- [x] `outputs.tf` exports `function_arn`, `function_name`, `invoke_arn`, `role_arn`
- [x] `terraform validate` in `modules/lambda-fn/` exits 0

**Tests:** none (terraform validate)
**Gate:** tf-validate

**Commit:** `feat(infra): add lambda-fn Terraform module`

---

### TI4: Terraform module `http-api` [P]

**What:** Create the reusable `modules/http-api` Terraform module. The module creates an API Gateway HTTP API (`aws_apigatewayv2_api`), a `$default` route with `$default` stage (`aws_apigatewayv2_stage`), an integration (`aws_apigatewayv2_integration`) pointing to a Lambda, and the `aws_lambda_permission` allowing API GW to invoke it.
**Where:**
- `infra/terraform/modules/http-api/main.tf`
- `infra/terraform/modules/http-api/variables.tf`
- `infra/terraform/modules/http-api/outputs.tf`

**Depends on:** TI2
**Requirement:** INFRA-11, INFRA-13

**Done when:**

- [x] `variables.tf` declares all variables from design.md § "modules/http-api"
- [x] `main.tf` creates `aws_apigatewayv2_api` (HTTP protocol), `aws_apigatewayv2_stage` (auto_deploy = true, `$default`), `aws_apigatewayv2_integration` (AWS_PROXY, payload format 2.0), `aws_apigatewayv2_route` (`$default`), `aws_lambda_permission`
- [x] `outputs.tf` exports `api_id`, `invoke_url`, `execution_arn`
- [x] `terraform validate` in `modules/http-api/` exits 0

**Tests:** none (terraform validate)
**Gate:** tf-validate

**Commit:** `feat(infra): add http-api Terraform module`

---

### TI5: Terraform module `iam-policy` [P]

**What:** Create the reusable `modules/iam-policy` Terraform module. Attaches an inline policy to an existing IAM role.
**Where:**
- `infra/terraform/modules/iam-policy/main.tf`
- `infra/terraform/modules/iam-policy/variables.tf`
- `infra/terraform/modules/iam-policy/outputs.tf`

**Depends on:** TI2
**Requirement:** INFRA-12, INFRA-13

**Done when:**

- [x] `variables.tf` declares all variables from design.md § "modules/iam-policy"
- [x] `main.tf` creates `aws_iam_role_policy` (inline) using a `aws_iam_policy_document` data source built from `var.effect`, `var.actions`, `var.resources`
- [x] `outputs.tf` exports `policy_id`
- [x] `terraform validate` in `modules/iam-policy/` exits 0

**Tests:** none (terraform validate)
**Gate:** tf-validate

**Commit:** `feat(infra): add iam-policy Terraform module`

---

### TI6: Terraform stack `shared` — OIDC provider + 3 GitHub Actions roles

**What:** Create `infra/terraform/stacks/shared/` which provisions the GitHub Actions OIDC identity provider and **three** IAM roles (`donaoferta-gha-dev`, `donaoferta-gha-staging`, `donaoferta-gha-prod`) each with its own trust scope and least-privilege inline policy (per design.md § "KD-5" and "KD-6").
**Where:**
- `infra/terraform/stacks/shared/main.tf`
- `infra/terraform/stacks/shared/variables.tf`
- `infra/terraform/stacks/shared/outputs.tf`
- `infra/terraform/stacks/shared/versions.tf`
- `infra/terraform/stacks/shared/backend.hcl.example` — template for local runs

**Depends on:** TI3, TI4, TI5 (modules available for reference)
**Requirement:** INFRA-14, INFRA-15, INFRA-16, INFRA-17

**Done when:**

- [x] `main.tf` creates (or data-sources) `aws_iam_openid_connect_provider` for `token.actions.githubusercontent.com` using `try`/`count` to avoid duplicate creation
- [x] `aws_iam_role.gha_dev` trust policy uses `StringLike` on sub matching `repo:digitalelvis/dona:*` (any ref — manual usage)
- [x] `aws_iam_role.gha_staging` trust policy uses `StringLike` matching `repo:digitalelvis/dona:ref:refs/heads/v*` OR `repo:digitalelvis/dona:pull_request`
- [x] `aws_iam_role.gha_prod` trust policy uses `StringLike` matching `repo:digitalelvis/dona:ref:refs/heads/main`
- [x] Three `module.gha_policy_<env>` instances attach resource-scoped least-privilege policies per design.md § "KD-6" (Lambda ARN scoped to `donaoferta-api-<env>`)
- [x] `outputs.tf` exports `role_arns = { dev = ..., staging = ..., prod = ... }` and `oidc_provider_arn`
- [x] `terraform validate` exits 0
- [x] `backend.hcl.example` documents bucket, key (`shared/terraform.tfstate`), region, dynamodb_table

**Tests:** none (terraform validate)
**Gate:** tf-validate

**Commit:** `feat(infra): add shared stack with 3 OIDC roles (dev, staging, prod)`

---

### TI7: Terraform stack `api` — parameterized Lambda + API GW for all environments

**What:** Create `infra/terraform/stacks/api/` which uses `archive_file` to zip `apps/api/dist/handler.mjs`, then calls `module.lambda` and `module.http_api` to deploy. All resource names use `var.environment` (no hardcoded `-dev`). Three `envs/*.tfvars` and three `backends/*.hcl` files cover dev, staging, and prod.
**Where:**
- `infra/terraform/stacks/api/main.tf` — parameterized via `var.environment`
- `infra/terraform/stacks/api/variables.tf` — adds `environment`, `memory_size`, `timeout`, `log_level`
- `infra/terraform/stacks/api/outputs.tf`
- `infra/terraform/stacks/api/versions.tf`
- `infra/terraform/stacks/api/envs/dev.tfvars` — NEW
- `infra/terraform/stacks/api/envs/staging.tfvars` — NEW
- `infra/terraform/stacks/api/envs/prod.tfvars` — NEW
- `infra/terraform/stacks/api/backends/dev.hcl` — NEW
- `infra/terraform/stacks/api/backends/staging.hcl` — NEW
- `infra/terraform/stacks/api/backends/prod.hcl` — NEW

**Depends on:** TI1 (dist/handler.mjs must exist at plan time), TI6 (shared stack applied first)
**Requirement:** INFRA-18, INFRA-19, INFRA-20, INFRA-21, INFRA-22

**Done when:**

- [x] `main.tf` uses `data.archive_file` with `source_file = abspath("${path.module}/../../../../apps/api/dist/handler.mjs")`
- [x] `module.lambda` instantiated with `function_name = "donaoferta-api-${var.environment}"`, `memory_size = var.memory_size`, `timeout = var.timeout` — **no hardcoded `-dev`**
- [x] `module.http_api` instantiated with `name = "donaoferta-http-api-${var.environment}"`
- [x] `outputs.tf` exports `invoke_url` and `environment`
- [x] `envs/dev.tfvars`, `envs/staging.tfvars`, `envs/prod.tfvars` match the values in design.md § "Terraform Stack `api`"
- [x] `backends/dev.hcl`, `backends/staging.hcl`, `backends/prod.hcl` use keys `api/dev/`, `api/staging/`, `api/prod/terraform.tfstate` respectively
- [x] `terraform validate` exits 0
- [x] **TI10 smoke:** tracked in [operator checklist §6](.specs/features/infra-terraform-base/tasks.md#next-steps-ti10--operator-checklist) (`curl …/health` after apply), not a repo file gate

**Tests:** none (terraform validate; E2E in TI10)
**Gate:** tf-validate

**Commit:** `feat(infra): add parameterized api stack with dev/staging/prod environments`

---

### TI8: GitHub Actions CI workflow [P]

**What:** Create `.github/workflows/ci.yml` that runs the full validation suite on PRs targeting `v0.1.x` or `main`. Authenticates to AWS via OIDC using the `staging` role for `terraform plan` (no apply).
**Where:**
- `.github/workflows/ci.yml` — NEW

**Depends on:** TI7 (stack + envs/ + backends/ exist for plan reference)
**Requirement:** INFRA-23, INFRA-24, INFRA-25, INFRA-28

**Done when:**

- [x] Workflow triggers on `pull_request` targeting `v0.1.x` and `main`
- [x] Job `validate` runs on `ubuntu-latest` with Node 22 + pnpm cache
- [x] Steps: `pnpm install` → `pnpm typecheck` → `pnpm lint` → `pnpm -w turbo run test` → `pnpm -w turbo run build`
- [x] Steps: `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.GHA_STAGING_ROLE_ARN }}` (GitHub repository variable) and `aws-region: us-east-1`
- [x] Steps: `hashicorp/setup-terraform@v3` with `terraform_version: "1.10.*"`
- [x] Steps: `terraform init -backend-config=backends/staging.hcl` → `terraform validate` → `terraform plan -var-file=envs/staging.tfvars` (api stack)
- [x] Workflow does NOT contain `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`

**Tests:** none (CI run itself is the test)
**Gate:** manual (open a draft PR)

**Commit:** `ci: add GitHub Actions CI workflow with OIDC auth and terraform plan (staging)`

---

### TI9a: GitHub Actions deploy-staging workflow [P]

**What:** Create `.github/workflows/deploy-staging.yml` that deploys to the `staging` environment on every push to `v*.x` development mainline branches.
**Where:**
- `.github/workflows/deploy-staging.yml` — NEW

**Depends on:** TI7
**Requirement:** INFRA-26

**Done when:**

- [x] Workflow triggers on `push` to branches matching `v*.x` pattern
- [x] Job `deploy` runs `pnpm install` → `pnpm -w turbo run build` → configure AWS OIDC (`${{ vars.GHA_STAGING_ROLE_ARN }}`) → `terraform init -backend-config=backends/staging.hcl` → `terraform apply -var-file=envs/staging.tfvars -auto-approve`
- [x] After apply, step extracts `invoke_url` via `terraform output -raw invoke_url` and writes `staging: <url>` to `$GITHUB_STEP_SUMMARY`
- [x] Workflow does NOT contain long-lived AWS credentials

**Tests:** none (deploy run is the test)
**Gate:** manual (push to `v0.1.x` triggers it)

**Commit:** `ci: add deploy-staging workflow (push to v*.x → staging apply)`

---

### TI9b: GitHub Actions deploy-prod workflow [P]

**What:** Create `.github/workflows/deploy-prod.yml` that deploys to the `prod` environment on every push to `main`.
**Where:**
- `.github/workflows/deploy-prod.yml` — NEW

**Depends on:** TI7
**Requirement:** INFRA-27

**Done when:**

- [x] Workflow triggers on `push` to `main`
- [x] Job `deploy` runs `pnpm install` → `pnpm -w turbo run build` → configure AWS OIDC (`${{ vars.GHA_PROD_ROLE_ARN }}`) → `terraform init -backend-config=backends/prod.hcl` → `terraform apply -var-file=envs/prod.tfvars -auto-approve`
- [x] After apply, step extracts `invoke_url` via `terraform output -raw invoke_url` and writes `prod: <url>` to `$GITHUB_STEP_SUMMARY`
- [x] Workflow does NOT contain long-lived AWS credentials

**Tests:** none (deploy run is the test)
**Gate:** manual (merge to `main` triggers it)

**Commit:** `ci: add deploy-prod workflow (push to main → prod apply)`

---

### TI10: End-to-end verification and PR

**What:** Apply the Terraform stacks in order for all environments, run the full gate suite, smoke test `dev` and `staging`, and open the PR `feat/infra-terraform-base → v0.1.x`.
**Where:** No source files created. Produces the verification log and PR.
**Depends on:** TI8, TI9a, TI9b

**Done when:**

- [ ] `terraform apply` on `bootstrap/` succeeds (S3 bucket + DynamoDB table created)
- [ ] `terraform apply` on `stacks/shared/` succeeds (OIDC provider + **3 IAM roles** created — dev, staging, prod)
- [ ] `pnpm -w turbo run build` exits 0 (produces `dist/handler.mjs`)
- [ ] `terraform init -backend-config=backends/dev.hcl && terraform apply -var-file=envs/dev.tfvars -auto-approve` succeeds → Lambda `donaoferta-api-dev` + API GW `donaoferta-http-api-dev` exist
- [ ] `terraform init -backend-config=backends/staging.hcl && terraform apply -var-file=envs/staging.tfvars -auto-approve` succeeds → `donaoferta-api-staging` exists
- [ ] `curl <dev_invoke_url>/health` returns `200 {"status":"ok",...}` from the internet
- [ ] `curl <staging_invoke_url>/health` returns `200 {"status":"ok",...}` from the internet
- [ ] GitHub repository variables `GHA_STAGING_ROLE_ARN` and `GHA_PROD_ROLE_ARN` set
- [ ] Full gate: `pnpm typecheck && pnpm lint && pnpm check:deps && pnpm check:tsconfig && pnpm -w turbo run test && pnpm -w turbo run build` exits 0
- [ ] PR opened `feat/infra-terraform-base → v0.1.x` with body referencing INFRA-01..INFRA-28, verification log, and both `invoke_url` values (dev + staging)
- [ ] Test count: ≥ 7 tests in `@donaoferta/api` (handler, health, HTTP routes)

**Note:** `prod` environment is provisioned by the `deploy-prod.yml` workflow automatically when the PR merges to `main`. No manual prod apply required in TI10.

**Tests:** none (this task IS the verification)
**Gate:** full + tf-plan + manual smoke test (dev + staging)

**Commit:** none (verification log goes into PR description)

---

## Execution Plan (updated)

### Phase 1 — TypeScript (no infra dependency)
```
TI1
```

### Phase 2 — Bootstrap
```
TI2
```

### Phase 3 — Terraform modules (parallel after TI2)
```
        ┌→ TI3 [P]  (modules/lambda-fn)
TI2 ────┼→ TI4 [P]  (modules/http-api)
        └→ TI5 [P]  (modules/iam-policy)
```

### Phase 4 — Stacks
```
TI3 + TI4 + TI5 → TI6 (stack shared — 3 roles)
TI1 + TI6       → TI7 (stack api — parameterized + envs/ + backends/)
```

### Phase 5 — CI/CD workflows (parallel after TI7)
```
        ┌→ TI8  [P]  (ci.yml — plan staging)
TI7 ────┼→ TI9a [P]  (deploy-staging.yml)
        └→ TI9b [P]  (deploy-prod.yml)
```

### Phase 6 — E2E verification + PR
```
TI8 + TI9a + TI9b → TI10
```

---

## Validation Tables

### Check 1 — Task Granularity

| Task | Scope | Status |
|---|---|---|
| TI1: Lambda handler | 2 files + 1 test | ✅ Granular |
| TI2: Bootstrap | 3 tf files | ✅ Granular |
| TI3: Module lambda-fn | 3 tf files | ✅ Granular |
| TI4: Module http-api | 3 tf files | ✅ Granular |
| TI5: Module iam-policy | 3 tf files | ✅ Granular |
| TI6: Stack shared | 5 tf files + 3 roles | ✅ Cohesive (one stack, one deployment unit) |
| TI7: Stack api | 5 tf files + 6 env/backend files | ✅ Cohesive (one stack, one configuration set) |
| TI8: CI workflow | 1 yaml file | ✅ Granular |
| TI9a: Deploy-staging workflow | 1 yaml file | ✅ Granular |
| TI9b: Deploy-prod workflow | 1 yaml file | ✅ Granular |
| TI10: E2E + PR | 0 files | ✅ Verification only |

All ✅.

### Check 2 — Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| TI1 | (none) | Phase 1 standalone | ✅ Match |
| TI2 | TI1 (branch, not code) | Phase 2 after TI1 | ✅ Match |
| TI3 [P] | TI2 | TI2 → TI3 | ✅ Match |
| TI4 [P] | TI2 | TI2 → TI4 | ✅ Match |
| TI5 [P] | TI2 | TI2 → TI5 | ✅ Match |
| TI6 | TI3, TI4, TI5 | TI3+TI4+TI5 → TI6 | ✅ Match |
| TI7 | TI1, TI6 | TI1+TI6 → TI7 | ✅ Match |
| TI8 [P] | TI7 | TI7 → TI8 | ✅ Match |
| TI9a [P] | TI7 | TI7 → TI9a | ✅ Match |
| TI9b [P] | TI7 | TI7 → TI9b | ✅ Match |
| TI10 | TI8, TI9a, TI9b | TI8+TI9a+TI9b → TI10 | ✅ Match |

All ✅.

### Check 3 — Test Co-location Validation

| Task | Code layer | Matrix requires | Task says | Status |
|---|---|---|---|---|
| TI1 | `apps/api/src/handler.ts` | unit | unit | ✅ OK |
| TI2 | Terraform bootstrap | none (tf-validate) | none | ✅ OK |
| TI3 | Module lambda-fn | none (tf-validate) | none | ✅ OK |
| TI4 | Module http-api | none (tf-validate) | none | ✅ OK |
| TI5 | Module iam-policy | none (tf-validate) | none | ✅ OK |
| TI6 | Stack shared | none (tf-validate) | none | ✅ OK |
| TI7 | Stack api | none (tf-plan) | none | ✅ OK |
| TI8 | CI workflow | none (manual) | none | ✅ OK |
| TI9a | Deploy-staging workflow | none (manual) | none | ✅ OK |
| TI9b | Deploy-prod workflow | none (manual) | none | ✅ OK |
| TI10 | Verification only | none | none | ✅ OK |

All ✅.
