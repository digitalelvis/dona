# donaoferta

**Vision:** Serverless platform for querying prices of supermarkets and local businesses, exposed both as a public **REST API** for integrators and as an **MCP server** for AI agents, fed by a data-driven price collector that consumes the stores' own public APIs.

**For:** (1) AI agents (Claude Desktop, Cursor, custom agents) that need to answer "where is it cheaper?"; (2) B2B integrators and partners consuming the REST API; (3) [Future] end users via a client application.

**Solves:** Removes the manual effort of comparing prices across supermarkets and local businesses by providing a single source of truth queryable by humans (REST) and by machines (MCP), with low latency and near-zero operational cost at early volumes.

---

## Goals

- **G1 — Latency:** P95 read latency ≤ **400 ms** end-to-end on both REST and MCP (cold-start mitigated by a documented strategy).
- **G2 — Cost:** Operate within the **AWS Free Tier** while volume ≤ 100k requests/month and ≤ 50 integrated stores. Above that, monthly cost must be predictable and linear.
- **G3 — Store extensibility:** Adding a new store must be a **data** operation (creating an `IntegrationConfig` item in DynamoDB), with **no code deploy**, in ≤ 30 minutes.
- **G4 — Portability:** The domain packages must not depend on any cloud SDK. Migrating from AWS to GCP must require rewriting only the `adapters-*` packages and the Terraform stack, leaving every other package and the apps untouched.
- **G5 — MCP compliance:** Conform to the stable MCP protocol revision (HTTP Streamable transport), tested against Claude Desktop and Cursor.

---

## Tech Stack

**Core**

- **Language:** TypeScript 5.x (`strict`, `noUncheckedIndexedAccess`)
- **Runtime:** Node.js 22 LTS (Lambda `nodejs22.x`)
- **Monorepo:** pnpm workspaces + Turborepo
- **HTTP framework:** Hono on Lambda + API Gateway HTTP API (REST) and Lambda Function URL (MCP streaming)
- **MCP:** `@modelcontextprotocol/sdk` (official TypeScript SDK), HTTP Streamable transport
- **Database:** DynamoDB (on-demand, single-table) — always accessed via the `Repository` ports defined in `packages/ports`
- **Product search:** DynamoDB filters / GSIs in v1 (no OpenSearch — see decision D-011)
- **Geographic search:** Geohash-encoded GSI on DynamoDB
- **Validation:** Zod (HTTP inputs, MCP tool inputs, configuration files)
- **Tests:** Vitest (unit + integration) + Testcontainers / LocalStack for AWS integration

**Platform**

- **Compute:** AWS Lambda by default; Lambda container images for handlers that need bigger binaries; **escape hatch** to AWS App Runner for workloads sensitive to cold-start (e.g., the AI agent), preserving the HTTP contract
- **Events / orchestration (future, M6):** EventBridge + SQS + Step Functions
- **IaC:** Terraform with remote state on S3 + locking on DynamoDB; reusable modules in `infra/terraform/modules`; stacks per bounded context
- **CI/CD:** GitHub Actions with OIDC to AWS (no long-lived keys)
- **Observability:** OpenTelemetry (OTLP) + AWS Distro for OpenTelemetry → CloudWatch / X-Ray; structured logs via `pino`
- **LLM:** Custom abstraction in `packages/llm-kit` (multi-provider). Default in v1: **Google Gemini 2.5 Flash-Lite via Google AI Studio / Vertex AI**. Adapters planned for AWS Bedrock, OpenAI and Anthropic.

**Principles**

- Clean / Hexagonal architecture per **bounded context**
- SOLID and Clean Code
- Immutable domain entities; `Result<T, E>` or typed exceptions for domain errors
- Manual dependency injection through a composition root inside each `apps/*` (no magic DI container in v1)

---

## Scope

**v1 includes:**

- **Foundation (M0):** monorepo, base IaC, observability, CI/CD, `dev` environment
- **Public REST API (M1):** queries for stores, branches (with geo nearby), products and offers; authentication via **API Key** with rate limit
- **On-demand Price Collector (M2):** integration with stores' public APIs through **data-driven configuration** (one `IntegrationConfig` DynamoDB item per store); collection triggered by REST/MCP requests when cache is stale; price history with **90-day** hot retention + monthly rollup
- **MCP server (M3):** tools `search_offers`, `get_stores_nearby`, `get_store_branches`, `get_price_history`; HTTP Streamable transport; two access tiers (internal full, public scoped)
- **AI Agent (M4):** in-house agent consuming MCP + `llm-kit`; runtime starts on Lambda Function URL with response streaming, with App Runner as a documented escape hatch

**Explicitly out of scope in v1:**

| Feature                                       | Reason                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Mobile / web frontend                         | Platform is API + MCP; UI belongs to consumers                                                               |
| HTML scraping (Cheerio / Playwright)          | Public store APIs cover the initial target stores; scraping becomes a Collector plugin in a future milestone |
| End-user authentication (OAuth, social, etc.) | API Key covers v1; user auth lands when there is a client app                                                |
| Administrative dashboard                      | `IntegrationConfig` and stores are managed via CLI/scripts initially; admin UI is future                     |
| Scheduled collection (cron)                   | v1 is on-demand only; scheduled collection lands in M6                                                       |
| BI / analytics dashboard                      | Operational metrics via CloudWatch are enough for v1                                                         |
| Multi-tenant / white-label                    | Single-tenant in v1                                                                                          |

---

## Constraints

- **Cost:** Maximize AWS Free Tier usage. Any managed service with a fixed monthly baseline (e.g., OpenSearch Serverless ~US$ 345/month minimum) requires explicit justification and approval before entering the design.
- **Latency:** see G1.
- **Portability:** see G4. Cloud SDKs must only be imported in `packages/adapters-*`. Domain packages (e.g., `packages/stores`, `packages/catalog`, `packages/users`, `packages/collector`, `packages/agent`) and apps (`apps/*`) must depend exclusively on `packages/ports` and `packages/core-kernel`.
- **Privacy:** End-user location data (future) must follow Brazilian LGPD; avoid persisting raw lat/long whenever a truncated geohash is sufficient.
- **Resources:** Project is initially developed by a single engineer; code must favor simplicity over speculative flexibility.
- **Multi-cloud:** AWS-first. A second cloud (GCP) only enters when there is a real business requirement. The architecture preserves the option but does not optimize for it in v1.
