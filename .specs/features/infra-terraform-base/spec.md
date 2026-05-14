# infra-terraform-base Specification

> **Milestone:** M0 — Foundation
> **Scope size:** Large (multi-component: Lambda adapter, Terraform IaC, CI/CD pipeline)
> **Sibling features in M0:** `foundation-monorepo` ✅, `observability-base` 🚧
> **Depends on:** `foundation-monorepo` (merged ✅)

## Problem Statement

The monorepo skeleton (`foundation-monorepo`) proves the toolchain works locally. Before any real milestone (M1+) can ship, the API must be reachable from the internet and deployable automatically. Without an automated deploy pipeline and a live AWS environment, every feature developed after this point would need manual deployment steps, creating a gap between local tests and real-world behaviour.

This feature closes that gap: it wires `apps/api` to AWS Lambda + API Gateway, provisions environments via Terraform with remote state, and connects GitHub Actions so PRs run validation plus `terraform plan`, pushes to `v*.x` deploy **staging**, and pushes to `main` deploy **prod** (see `design.md` / `tasks.md`).

## Goals

- [ ] **G-A:** `curl https://<api-gw-url>/health` returns `200` with the expected JSON body from a deployed Lambda in `us-east-1` (or `sa-east-1`).
- [ ] **G-B:** Every PR against `v0.1.x` runs the full validation pipeline (typecheck → lint → test → build → terraform plan) without any long-lived AWS credentials.
- [ ] **G-C:** The `dev` environment monthly cost stays ≤ US$ 1 (within AWS Free Tier for Lambda + API Gateway).
- [ ] **G-D:** `apps/api` gains a Lambda-compatible handler entry-point (`src/handler.ts`) that reuses the same Hono `compose()` root, keeping the local and Lambda paths in sync.
- [ ] **G-E:** Terraform state is stored remotely (S3 + DynamoDB locking) so CI and local runs share consistent state.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Custom domain / Route 53 | Not needed for `dev`; deferred until M0 acceptance |
| SSL certificate (ACM) | API Gateway HTTP API provides HTTPS by default on the generated URL |
| WAF / Shield | Security hardening lands in M5 |
| Extra environments beyond dev/staging/prod | Only three envs + OIDC roles in this feature; more envs → later milestone |
| DynamoDB tables for domain data | Belong to M1 features; only the state-lock table is provisioned here |
| OpenTelemetry / X-Ray instrumentation | Belongs to `observability-base` (sibling M0 feature) |
| VPC / private networking | Lambda runs outside VPC for simplicity in v1; revisit if data sensitivity requires it |
| Lambda container images | Not needed while the bundle stays < 50 MB |
| Provisioned concurrency | Deferred; revisit with real P95 data in M1 |
| GitHub org-level rulesets | Only repo-level rulesets needed for M0; org governance is a separate concern |
| Signed commits requirement | Not enforced in M0; deferred to a security hardening milestone |
| CODEOWNERS as merge gate | No `CODEOWNERS` file exists; deferred |
| Terraform-managed rulesets (`github_repository_ruleset`) | Deferred; M0 uses manual GitHub Settings configuration — see `design.md` KD-10 |

---

## User Stories

### P1: Lambda handler entry-point for `apps/api` ⭐ MVP

**User Story:** As a developer, I want `apps/api` to expose a Lambda-compatible handler alongside the existing local server, so that the same Hono composition root runs in both environments without duplication.

**Why P1:** Without this, deploying to Lambda requires a separate app or code fork — violating DRY and making the composition root inconsistent between local and production.

**Acceptance Criteria:**

1. WHEN `apps/api/src/handler.ts` is built THEN it SHALL export a `handler` function compatible with the AWS Lambda `nodejs22.x` runtime and API Gateway HTTP API (payload format 2.0).
2. WHEN the Lambda handler receives an API Gateway event THEN it SHALL invoke the same Hono application built by `compose()` and return the correctly shaped Lambda response.
3. WHEN the Lambda handler receives `GET /health` THEN it SHALL return `{ statusCode: 200, body: '{"status":"ok",...,"traceId":...}' }` (same JSON contract as the local path, including `traceId` when OTel is active).
4. WHEN `pnpm -w turbo run build --filter=@donaoferta/api` runs THEN it SHALL emit both `dist/local.mjs` (unchanged) and `dist/handler.mjs` as separate entry-points.
5. WHEN the handler entry-point is unit-tested THEN it SHALL be tested by constructing a minimal API Gateway v2 event and asserting on the returned `statusCode` and `body`.

**Independent Test:** Build `dist/handler.mjs`, invoke it directly with a crafted API Gateway v2 payload via a test or `node -e`, observe `statusCode: 200`.

---

### P1: Terraform remote state bootstrap ⭐ MVP

**User Story:** As an infrastructure engineer, I want Terraform remote state (S3 + DynamoDB) initialised once, so that all subsequent Terraform runs (local and CI) share the same state file and never conflict.

**Why P1:** Without remote state, parallel CI runs corrupt the state file. This is the prerequisite for every subsequent Terraform stack.

**Acceptance Criteria:**

1. WHEN `infra/terraform/bootstrap/` is applied THEN it SHALL create an S3 bucket (`donaoferta-tfstate-<account_id>`) with versioning and server-side encryption, and a DynamoDB table (`donaoferta-tf-locks`) for state locking.
2. WHEN the S3 bucket is created THEN it SHALL block all public access.
3. WHEN the bootstrap is applied a second time THEN Terraform SHALL report no changes (idempotent).
4. WHEN any subsequent stack configures its backend THEN it SHALL reference the same bucket and lock table.

**Independent Test:** `cd infra/terraform/bootstrap && terraform init && terraform plan` exits 0 with "0 to add, 0 to change, 0 to destroy" after first apply.

---

### P1: Terraform modules: `lambda-fn`, `http-api`, `iam-policy` ⭐ MVP

**User Story:** As an infrastructure engineer, I want reusable Terraform modules for the common patterns (Lambda function, API Gateway HTTP API, IAM policy), so that stacks compose these modules without copy-pasting resource definitions.

**Why P1:** Modules are the foundation of every future stack; defining them here avoids duplication across M1+ stacks.

**Acceptance Criteria:**

1. WHEN `modules/lambda-fn` is instantiated THEN it SHALL create a Lambda function with configurable `function_name`, `handler`, `runtime` (`nodejs22.x`), `memory_size`, `timeout`, `architecture` (`arm64` / `x86_64`), `environment` (tag label), `environment_variables` map, optional `layers` list, and X-Ray **PassThrough** tracing mode so ADOT can own segments when layers are attached.
2. WHEN `modules/http-api` is instantiated THEN it SHALL create an API Gateway HTTP API, a `$default` route proxying all traffic to a given Lambda ARN, a Lambda permission allowing API GW to invoke the function, and output the `invoke_url`.
3. WHEN `modules/iam-policy` is instantiated THEN it SHALL attach a named inline or managed policy to a given IAM role ARN, with configurable `effect`, `actions`, and `resources`.
4. WHEN any module is applied THEN all resources SHALL include a `tags` map inheriting at least `project = "donaoferta"` and `environment`.

**Independent Test:** `terraform validate` on each module directory exits 0.

---

### P1: Terraform stack `shared` — OIDC trust for GitHub Actions ⭐ MVP

**User Story:** As a platform engineer, I want a GitHub Actions IAM role provisioned via OIDC, so that CI can deploy to AWS without storing long-lived credentials as GitHub secrets.

**Why P1:** Long-lived AWS keys in GitHub secrets are a security risk. OIDC is the recommended approach for GitHub Actions → AWS authentication and is required before the deploy step can be safely automated.

**Acceptance Criteria:**

1. WHEN the `shared` stack is applied THEN it SHALL create an IAM OIDC identity provider for `token.actions.githubusercontent.com` (if not already present) and an IAM role `donaoferta-github-actions-<env>` that trusts the provider, scoped to the specific GitHub repository and branches defined in the configuration.
2. WHEN the `shared` stack is applied THEN the role SHALL have a permission policy allowing the minimum actions needed for the `api` stack (Lambda update, API GW describe, S3 state read/write, DynamoDB state lock).
3. WHEN the `shared` stack is applied a second time THEN Terraform SHALL report no changes (idempotent).
4. WHEN a GitHub Actions workflow runs on the configured repository THEN `aws sts get-caller-identity` SHALL succeed using the OIDC role (no hard-coded keys).

**Independent Test:** Apply the stack, configure the workflow, run a test job that only executes `aws sts get-caller-identity`, observe the account ID returned.

---

### P1: Terraform stack `api` — deploy `apps/api` to Lambda ⭐ MVP

**User Story:** As a developer, I want `apps/api` deployed to Lambda in the `dev` environment, accessible via API Gateway, so that the end-to-end cloud path is proven before adding real domain features.

**Why P1:** This is the primary acceptance criterion for M0 — without a live deployed endpoint the milestone is incomplete.

**Acceptance Criteria:**

1. WHEN the `api` stack is applied THEN it SHALL create a Lambda function `donaoferta-api-dev` with the bundled `dist/handler.mjs` from `apps/api`, using the `nodejs22.x` runtime.
2. WHEN the `api` stack is applied THEN it SHALL create an API Gateway HTTP API routing all requests to the Lambda function and output the `invoke_url`.
3. WHEN `GET /health` is called THEN it SHALL return `{ "status": "ok", "uptimeSeconds": <n>, "version": "<semver>", "traceId": <string|null> }` (`traceId` populated when OpenTelemetry is active; `null` until `observability-base` completes).
4. WHEN a deploy is triggered THEN it SHALL package the Lambda function from the Turborepo `dist/` artifact without uploading `node_modules/` (all dependencies bundled by tsup).
5. WHEN the `api` stack is applied a second time with no code changes THEN Terraform SHALL report no changes (idempotent).

**Independent Test:** `terraform apply` on the `api` stack, then `curl $(terraform output -raw invoke_url)/health | jq`.

---

### P1: GitHub Actions CI pipeline ⭐ MVP

**User Story:** As a developer, I want every PR against `v0.1.x` or `main` to run the full validation suite automatically, pushes to `v*.x` to deploy **staging**, and pushes to `main` to deploy **prod**, so that broken code never reaches production without passing CI.

**Why P1:** Without automated CI, the gate checks defined in `foundation-monorepo` are only run manually. CI is the enforcement mechanism that makes the earlier work meaningful.

**Acceptance Criteria:**

1. WHEN a pull request targets `v0.1.x` or `main` THEN GitHub Actions SHALL run the `ci` workflow: `pnpm install` → `pnpm typecheck` → `pnpm lint` → `pnpm -w turbo run test` → `pnpm -w turbo run build` → `terraform plan` (on the `api` stack).
2. WHEN the `ci` workflow authenticates to AWS THEN it SHALL use the OIDC role from the `shared` stack — no `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets.
3. WHEN any step in the `ci` workflow fails THEN the workflow SHALL exit non-zero and the PR SHALL be blocked from merging.
4. WHEN a push lands on a branch matching `v*.x` THEN the `deploy-staging` workflow SHALL run `pnpm -w turbo run build` followed by `terraform apply -auto-approve` on the `api` stack with `envs/staging.tfvars`.
5. WHEN a push lands on `main` THEN the `deploy-prod` workflow SHALL run the same for `envs/prod.tfvars`.
6. WHEN either deploy workflow succeeds THEN it SHALL post a GitHub Actions summary with the API Gateway `invoke_url`.
7. WHEN the `ci` workflow runs on a PR THEN it SHALL complete in ≤ 5 minutes (excluding queue time) on a standard `ubuntu-latest` runner.

**Independent Test:** Open a draft PR against `v0.1.x` with a deliberate typecheck error; observe the `ci` workflow fail on the typecheck step. Fix the error; observe green.

---

### P2: GitHub Branch Rulesets — merge enforcement

**User Story:** As a maintainer, I want GitHub Branch Rulesets configured on `main` and release branches (`v*.x`), so that no code can be merged without a passing CI run and an approved pull request — enforcing the git flow defined in the repository governance.

**Why P2:** Rulesets are not a prerequisite for the Lambda deploy (hence P2, not P1), but they are required to close the governance gap: without them, anyone with write access can push directly to `main` or merge a PR with a failing `ci.yml`, bypassing all the checks the CI pipeline was designed to enforce.

**Acceptance Criteria:**

1. WHEN a Branch Ruleset is applied with target patterns covering `~DEFAULT_BRANCH` (`main`) and `refs/heads/v*.*.x` THEN both ref families SHALL be governed by the ruleset.
2. WHEN a contributor attempts to push directly to `main` or any `v*.x` branch THEN GitHub SHALL block the push; only pull-request merges are permitted on those refs.
3. WHEN a pull request targets a protected ref THEN the `validate` job of the `CI` workflow (context string `CI / validate`) SHALL be listed as a required status check and the PR SHALL NOT be mergeable until that check passes.
4. WHEN a contributor attempts to force-push to `main` or any `v*.x` branch THEN GitHub SHALL block the force push.
5. WHEN a contributor attempts to delete `main` or any `v*.x` branch THEN GitHub SHALL block the deletion.

**Independent Test:** Open a draft PR against `v0.1.x`; with a failing or pending `CI / validate` check, observe the "Merge pull request" button is disabled and the required check is listed. Once the check passes, observe the button is enabled.

---

## Edge Cases

- WHEN Terraform state is locked (a previous run crashed mid-apply) THEN the operator SHALL be able to force-unlock via `terraform force-unlock <lock-id>`; the lock table item will hold the ID.
- WHEN the `ci.yml` workflow or the `validate` job is renamed THEN the required status check name in the Ruleset SHALL be updated to match the new context string (`<workflow-name> / <job-name>`); a name mismatch silently prevents the check from ever satisfying the ruleset.
- WHEN a repository admin bypasses a ruleset to perform an emergency merge THEN the bypass SHALL be logged in the GitHub audit log; repository admins are the only permitted bypass actors for these rulesets.
- WHEN `feat/*` branches are created THEN they are intentionally NOT covered by the protected-ref ruleset; contributors push freely to feature branches.
- WHEN the `Require branches to be up-to-date before merging` option is enabled THEN every new commit on the target branch invalidates open PRs and forces a new CI run; this prevents stale CI but increases queue time during active development — deferred to a later milestone once the team grows.
- WHEN the Lambda cold-start causes `/health` to exceed 500 ms THEN the response SHALL still succeed (HTTP 200); no timeout is set below 5 s for `dev`.
- WHEN the API Gateway URL is queried for an unknown path THEN the Lambda handler SHALL return `404` with the standard error body (behaviour inherited from `foundation-monorepo` Hono error handler).
- WHEN `terraform plan` runs in CI without `apply` permission THEN it SHALL read-only succeed using scoped IAM actions, never blocking the CI run.
- WHEN the S3 state bucket already exists (re-running bootstrap on existing account) THEN `terraform apply` SHALL succeed with no changes rather than failing on a duplicate resource.
- WHEN `apps/api` bundle exceeds the Lambda 50 MB unzipped limit THEN the build step SHALL fail with a clear error before deploy (validated by a `max_size` check in `tsup.config.ts` or CI).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| INFRA-01 | P1: Lambda handler entry-point | Implementing | Code in repo — verify in TI10 |
| INFRA-02 | P1: Lambda handler entry-point | Implementing | Code in repo — verify in TI10 |
| INFRA-03 | P1: Lambda handler entry-point | Implementing | Code in repo — verify in TI10 |
| INFRA-04 | P1: Lambda handler entry-point | Implementing | Code in repo — verify in TI10 |
| INFRA-05 | P1: Lambda handler entry-point | Implementing | Code in repo — verify in TI10 |
| INFRA-06 | P1: Terraform remote state bootstrap | Implementing | Code in repo — verify in TI10 |
| INFRA-07 | P1: Terraform remote state bootstrap | Implementing | Code in repo — verify in TI10 |
| INFRA-08 | P1: Terraform remote state bootstrap | Implementing | Code in repo — verify in TI10 |
| INFRA-09 | P1: Terraform remote state bootstrap | Implementing | Code in repo — verify in TI10 |
| INFRA-10 | P1: Terraform modules | Implementing | Code in repo — verify in TI10 |
| INFRA-11 | P1: Terraform modules | Implementing | Code in repo — verify in TI10 |
| INFRA-12 | P1: Terraform modules | Implementing | Code in repo — verify in TI10 |
| INFRA-13 | P1: Terraform modules | Implementing | Code in repo — verify in TI10 |
| INFRA-14 | P1: Shared stack — OIDC | Implementing | Code in repo — verify in TI10 |
| INFRA-15 | P1: Shared stack — OIDC | Implementing | Code in repo — verify in TI10 |
| INFRA-16 | P1: Shared stack — OIDC | Implementing | Code in repo — verify in TI10 |
| INFRA-17 | P1: Shared stack — OIDC | Implementing | Code in repo — verify in TI10 |
| INFRA-18 | P1: API stack — Lambda deploy | Implementing | Code in repo — verify in TI10 |
| INFRA-19 | P1: API stack — Lambda deploy | Implementing | Code in repo — verify in TI10 |
| INFRA-20 | P1: API stack — Lambda deploy | Implementing | Code in repo — verify in TI10 |
| INFRA-21 | P1: API stack — Lambda deploy | Implementing | Code in repo — verify in TI10 |
| INFRA-22 | P1: API stack — Lambda deploy | Implementing | Code in repo — verify in TI10 |
| INFRA-23 | P1: CI pipeline | Implementing | Code in repo — verify in TI10 |
| INFRA-24 | P1: CI pipeline | Implementing | Code in repo — verify in TI10 |
| INFRA-25 | P1: CI pipeline | Implementing | Code in repo — verify in TI10 |
| INFRA-26 | P1: CI pipeline | Implementing | Code in repo — verify in TI10 |
| INFRA-27 | P1: CI pipeline | Implementing | Code in repo — verify in TI10 |
| INFRA-28 | P1: CI pipeline | Implementing | Code in repo — verify in TI10 |
| INFRA-29 | P2: GitHub Branch Rulesets | In Design | Pending manual configuration — verify in TI10 step 9 |
| INFRA-30 | P2: GitHub Branch Rulesets | In Design | Pending manual configuration — verify in TI10 step 9 |
| INFRA-31 | P2: GitHub Branch Rulesets | In Design | Pending manual configuration — verify in TI10 step 9 |
| INFRA-32 | P2: GitHub Branch Rulesets | In Design | Pending manual configuration — verify in TI10 step 9 |
| INFRA-33 | P2: GitHub Branch Rulesets | In Design | Pending manual configuration — verify in TI10 step 9 |

**ID format:** `INFRA-NN`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 33 total (INFRA-01–28 CI/deploy pipeline; INFRA-29–33 GitHub rulesets)

---

## Success Criteria

- [ ] `curl https://<api-gw-invoke-url>/health` returns `200` with JSON including `"status":"ok"` (and `traceId` once `observability-base` is verified).
- [ ] CI pipeline is green end-to-end on a sample PR (typecheck, lint, test, build, terraform plan all pass).
- [ ] Deploy workflows run on the configured branches without any manually stored AWS credentials (`deploy-staging` → staging, `deploy-prod` → prod).
- [ ] Monthly cost of the `dev` environment ≤ US$ 1 (Lambda + API GW free tier).
- [ ] `terraform apply` on the `api` stack is idempotent (second apply = no changes).
- [ ] Branch Rulesets are active on `main` and `v*.x`; a PR without a passing `CI / validate` check cannot be merged.
