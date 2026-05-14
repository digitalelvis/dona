# donaoferta — Roadmap

Milestones are organized around **independently shippable value**. Each milestone has verifiable acceptance criteria and produces one or more features under `.specs/features/`.

## Status legend

`📋 Planned` · `🚧 In progress` · `✅ Done` · `⏸ Paused` · `❌ Cancelled`

---

## M0 — Foundation 🚧

**Goal:** Repository runnable end-to-end with a trivial endpoint deployed to AWS through Terraform, observability wired in, and CI/CD validating pull requests.

**Deliverables:**

- pnpm + Turborepo monorepo with `lint`, `typecheck`, `test`, `build` pipelines
- `packages/core-kernel` (Result, Clock, Id, Errors), `packages/ports` (interfaces), `packages/observability`
- `apps/api` with a minimal `GET /health` Hono handler on Lambda + API Gateway HTTP API
- `infra/terraform/bootstrap`: remote state (S3 + DynamoDB locking; `use_lockfile` migration when ready — see post-completion list below)
- `infra/terraform`: modules `lambda-fn`, `http-api`, `iam-policy`; stacks **`shared`** (GitHub OIDC IAM for Actions) and **`api`** with **dev**, **staging**, and **prod** (`backends/*.hcl`, `envs/*.tfvars`)
- GitHub Actions **CI** on pull requests to **`v0.1.x`** and **`main`**: install → typecheck → test → build → Terraform **init / validate / plan** for **`api` staging**
- GitHub Actions **deploy**: push to **`v*.x`** → **Deploy staging**; push to **`main`** → **Deploy prod** (OIDC roles from `shared`)
- Baseline observability (**planned** under `observability-base`): OpenTelemetry + ADOT layer; JSON logs; X-Ray enabled

**Acceptance criteria:**

- `curl <deployed-api-invoke-url>/health` returns `200` with expected JSON for **staging** (and dev as applicable); trace correlation in responses or logs once `observability-base` is done
- CI is green end-to-end on a sample PR to `v0.1.x` or `main`, including the **staging** Terraform plan job
- Non-production environments remain within the project’s low monthly cost guardrail (validated during TI10 / operator sign-off)

**Expected features:** `foundation-monorepo` ✅, `infra-terraform-base` ⏸, `observability-base` 📋

### M0 — post `infra-terraform-base` (before closing M0)

- Complete **TI10** (AWS apply, smoke `curl …/health`, confirm GitHub `GHA_STAGING_ROLE_ARN` / `GHA_PROD_ROLE_ARN`, green CI on a real PR): operator checklist in [.specs/features/infra-terraform-base/tasks.md](.specs/features/infra-terraform-base/tasks.md) (“Next steps (TI10 — operator checklist)”).
- **Terraform S3 backend:** address the deprecated `dynamodb_table` setting and migrate toward **`use_lockfile`** when the team standardises on a Terraform minor that documents the path (coordinate with `infra/terraform/stacks/shared/backend.hcl.example` and `infra/terraform/stacks/api/backends/*.hcl`).
- **D-018 follow-up:** tighten root `engines.node` to **`22.x`** once contributors are on Node 22 (see [.specs/project/STATE.md](.specs/project/STATE.md) D-018).

---

## M1 — Stores Catalog 📋

**Goal:** Queryable REST API for stores and branches with working geographic search, populated via seed.

**Deliverables:**

- `packages/domain-stores` (Store, Branch, GeoPoint value objects; use-cases `FindBranchesNearby`, `GetStoreBySlug`, `ListStores`)
- `packages/adapters-aws` with `DynamoStoreRepository` + `GeohashIndex`
- REST endpoints: `GET /stores`, `GET /stores/:slug`, `GET /stores/:slug/branches`, `GET /branches?lat=&lng=&radiusKm=`
- **API Key** authentication (simple Lambda authorizer with a DynamoDB lookup)
- `pnpm seed:stores` script that populates DynamoDB from YAML/JSON under `tools/seed/`
- OpenAPI documentation generated through `@hono/zod-openapi`

**Acceptance criteria:**

- Proximity search returns the correct branches for a fixed seed (E2E tests)
- P95 < 400 ms for `GET /branches?lat=...` with 1k branches in DynamoDB
- Per-API-Key rate limiting works (load test rejects above the configured limit)

**Expected features:** `stores-domain`, `stores-api-endpoints`, `api-key-auth`

---

## M2 — Catalog & Price Collector 📋

**Goal:** On-demand price collection from stores' public APIs with fully data-driven configuration, exposed via REST.

**Deliverables:**

- `packages/domain-catalog` (Product, Offer, PriceHistory)
- `packages/domain-collector` with a **declarative engine**:
  - `IntegrationConfig` (one DynamoDB item per store): `source`, `auth`, `pagination`, `requestPipeline`, `responseMapping`, `cachePolicy`
  - Registered operators: `httpRequest`, `applyAuth`, `paginate`, `jsonPath`, `regex`, `mapTo`, `normalizeMoney`, `lookupOrCreateProduct`, `emitOffer`
- Endpoint `GET /offers?productQuery=&branchId=&maxStaleMinutes=` that triggers the collector when the cache is stale
- Retention: 90 days hot in DynamoDB + monthly aggregation job (written but not scheduled in v1)
- **5 integrated stores** via `IntegrationConfig` (per D-015 — full set documented in `.specs/research/legacy-stores-seed.md`): Tenda Atacado, Arena Atacado, Atacadão, Supermercados Pague Menos, Supermercados São Vicente (7 branches in Sumaré-SP, Americana-SP and Nova Odessa-SP). This set exercises every protocol/shape combination the engine must support: REST query-string + GraphQL; price-variation `object` + `array`; per-branch inventory present + absent.

**Acceptance criteria:**

- Adding a 4th store only requires inserting a new `IntegrationConfig` (zero deploy)
- Price history for a product returns points over the last 90 days
- P95 with fresh cache < 400 ms; P95 with refresh ≤ 3 s

**Expected features:** `catalog-domain`, `price-collector-engine`, `integration-configs-seed`, `offers-api-endpoints`

---

## M3 — MCP Server 📋

**Goal:** A stable MCP server tested against Claude Desktop and Cursor, with tools covering the "where is it cheaper?" use case.

**Deliverables:**

- `apps/mcp` on Lambda Function URL (HTTP Streamable transport)
- `packages/mcp-kit` (tool registry, Zod-validated inputs/outputs, mapping from domain errors to MCP errors)
- v1 tools: `search_offers`, `get_stores_nearby`, `get_store_branches`, `get_price_history`
- Two access tiers configured via API Key + scopes:
  - **internal** — access to every tool
  - **public** — read-only, aggressive rate limit, no `get_price_history`
- Installation guide for Claude Desktop and Cursor

**Acceptance criteria:**

- Claude Desktop and Cursor connect, list tools, and complete one end-to-end use case successfully
- Streaming works (a tool returning a large payload arrives in chunks)
- MCP contract tests (input/output schemas) are green in CI

**Expected features:** `mcp-server-app`, `mcp-tools-stores`, `mcp-tools-offers`, `mcp-auth-tiers`

---

## M4 — AI Agent 📋

**Goal:** In-house agent consuming the REST API and the MCP server, delivering a conversational experience ("where is the cheapest Ninho 800g near me?").

**Deliverables:**

- `packages/llm-kit` with multi-provider abstraction: `LlmClient` interface (chat, tool calls, streaming) with adapters `gemini` (Vertex AI / AI Studio, default), `bedrock`, `openai`, `anthropic`
- `packages/domain-agent` (Conversation, Turn, Tool, AgentRun)
- `apps/agent-runtime` on Lambda Function URL with response streaming
- REST endpoint `POST /chat` that delegates to the agent and returns SSE
- **Runtime decision** revisited with real data: if the agent's P95 is consistently > 3 s, migrate to App Runner while keeping the HTTP contract
- Telemetry on tool calls (which tool, latency, error)

**Acceptance criteria:**

- Use case "find the cheapest offer of product X near ZIP Y" responds correctly with P95 < 8 s
- Swapping provider (Gemini ↔ OpenAI ↔ Bedrock) is an env-var change
- Cost per conversation is traceable

**Expected features:** `llm-kit-multi-provider`, `agent-domain`, `agent-runtime-app`, `chat-endpoint`

---

## M5 — Hardening & Observability+ 📋

**Goal:** Ready to take controlled external traffic.

**Deliverables:**

- CloudWatch dashboards per bounded context
- SLO-based alerts (latency, error rate)
- Runbooks under `docs/runbooks/`
- Internal pen-test: least-privilege IAM review; injection testing on MCP tools
- Scheduled DynamoDB on-demand snapshots
- Public documentation (static docs site on S3 + CloudFront, generated from OpenAPI and MCP schemas)

**Acceptance criteria:**

- Game day exercising LLM provider failure, integrated-store failure, and traffic burst — all with documented recovery

**Expected features:** `observability-dashboards`, `slo-alerts`, `security-review`, `docs-site`

---

## M6 — Scheduled Collection & Analytics 📋

**Goal:** Reduce latency on hot queries through pre-collection and enable ad-hoc analytics.

**Deliverables:**

- EventBridge schedules per store/category triggering Step Functions
- Step Functions orchestrating parallel collection with SQS dead-letter
- Materialized monthly rollups for long-term history
- S3 + Athena export for ad-hoc analytical queries

**Acceptance criteria:**

- Top-1000 catalog products are always cached fresh
- Scheduled-collection cost documented per store

**Expected features:** `scanner-scheduling`, `step-functions-orchestration`, `analytics-export`

---

## Backlog (not yet prioritized)

| Theme                                                       | Trigger to prioritize                                   |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| End-user authentication (Cognito or Clerk)                  | When a client app exists                                |
| OAuth for public MCP (MCP 2025 compliance)                  | When MCP is exposed outside the trusted network         |
| Scraping plugin (Cheerio / Playwright on Lambda containers) | When a target store has no API                          |
| Recommendation engine                                       | When the dataset is rich enough                         |
| OpenSearch Serverless for full-text product search          | When DynamoDB filters no longer scale (>5k active SKUs) |
| Real multi-cloud (GCP adapter)                              | Concrete business requirement                           |
| Multi-tenant / white-label                                  | B2B demand                                              |
| GraphQL gateway                                             | If composed-front use cases appear                      |

---

## Critical milestone dependencies

```
M0 ──► M1 ──► M2 ──► M3 ──► M5
                 └──► M4 ──► M5
                              └──► M6
```

- M3 (MCP) and M4 (Agent) depend on M2 (real data).
- M5 (hardening) is the gate before any uncontrolled external traffic.
- M6 only makes sense once M2 is in production and volume justifies pre-collection.
