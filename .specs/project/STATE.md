# donaoferta — State (persistent memory)

> Persistent memory across sessions. Update whenever a decision is made, a blocker appears, or an idea is deferred.

---

## Active focus

- **Phase:** Specify → `infra-terraform-base` (M0, second feature)
- **Milestone:** M0 — Foundation
- **Previous:** `foundation-monorepo` ✅ merged to `v0.1.x` via [PR #1](https://github.com/digitalelvis/dona/pull/1)

---

## Decisions log

### D-001 — MVP scope is "all new" (all capabilities from M1 onward)

- **When:** 2026-05-13
- **Context:** Migration from a Laravel monolith to a serverless Node monorepo. Considered scoping down to API+Scanner only or MCP+Agent only.
- **Decision:** Build API + MCP + Collector + Agent as v1 target capabilities, distributed across milestones M1–M4.
- **Rationale:** User explicitly chose "all new" scope; risk mitigated by independent milestones with their own acceptance criteria.
- **Status:** Active

### D-002 — AI Agent runtime: Lambda first, App Runner as escape hatch

- **When:** 2026-05-13
- **Context:** AI agents can have long turns (5–30 s with tool calls), sensitive to cold-start.
- **Decision:** Implement the agent on Lambda Function URL with response streaming + provisioned concurrency if needed. Keep the HTTP/SSE contract stable so that migrating to App Runner is a transparent replacement.
- **Rationale:** Lambda's minimum cost vs. Fargate/App Runner baseline; revisit with real data in M4.
- **Status:** Active. Re-evaluate in M4 with measured P95.

### D-003 — Multi-provider LLM via custom abstraction

- **When:** 2026-05-13
- **Decision:** Create `packages/llm-kit` exposing an `LlmClient` interface with adapters for Gemini (Vertex AI / AI Studio), Bedrock, OpenAI and Anthropic.
- **Rationale:** Avoid provider lock-in; allow A/B in production; aligned with portability principle (G4).
- **Status:** Active

### D-004 — Price Collector reads public store APIs (no scraping in v1)

- **When:** 2026-05-13
- **Context:** Original plan was scraping; user reoriented to integration via the stores' own public APIs.
- **Decision:** v1 Collector is a **declarative HTTP integration engine** driven by data in DynamoDB. Each store is one `IntegrationConfig`. Scraping (Cheerio / Playwright) lands later as an additional set of **operators** in the engine.
- **Rationale:** Lower technical and ethical complexity; ToS-friendly; lower latency.
- **Status:** Active. **Validate before M2:** which target stores actually expose usable public APIs.

### D-005 — Monorepo tooling: pnpm + Turborepo

- **When:** 2026-05-13
- **Decision:** pnpm workspaces for dependency management, Turborepo for build/test cache.
- **Rationale:** Large community, low overhead, good DX. Nx evaluated and judged too opinionated for a small team.
- **Status:** Active

### D-006 — Auth in v1: API Key only

- **When:** 2026-05-13
- **Decision:** v1 authenticates clients via API Key (Lambda authorizer with a DynamoDB lookup). End-user auth (Cognito or Clerk) is deferred until there is a client app.
- **Rationale:** Reduces scope; sufficient for B2B and for internal/public MCP tiers.
- **Status:** Active

### D-007 — MCP audience: two tiers (internal + scoped public)

- **When:** 2026-05-13
- **Decision:** Expose MCP with two tiers via API Key + scope: `internal` (all tools) and `public` (subset, aggressive rate limit, no history).
- **Rationale:** Enables external agent usage (Claude Desktop, Cursor) without exposing sensitive data; keeps full internal capability.
- **Status:** Active. Revisit OAuth when a future MCP revision mandates it.

### D-008 — Price retention: 90 days hot + monthly rollup

- **When:** 2026-05-13
- **Decision:** PriceHistory keeps individual points for 90 days via TTL. A rollup job writes one monthly point per (product, branch) for long-term history.
- **Rationale:** Balances DynamoDB cost with analytical usefulness.
- **Status:** Active

### D-009 — HTTP framework: Hono

- **When:** 2026-05-13
- **Decision:** Hono is the HTTP framework across every app that serves HTTP (REST API, MCP server, agent runtime).
- **Rationale:** Lightweight (~14 KB), native streaming (critical for MCP and the agent), multi-runtime (preserves portability), strong Zod integration via `@hono/zod-openapi`.
- **Status:** Active

### D-010 — Database: DynamoDB single-table by default

- **When:** 2026-05-13
- **Decision:** DynamoDB on-demand, single-table design. Access always goes through the `Repository` ports defined in `packages/ports`. Domain code never imports the AWS SDK.
- **Rationale:** Free tier, automatic scaling, near-zero idle cost; the abstraction preserves G4 (portability).
- **Status:** Active

### D-011 — Product search in v1: DynamoDB filters / GSIs only (no OpenSearch)

- **When:** 2026-05-13
- **Context:** OpenSearch Serverless has a minimum monthly baseline (~US$ 345/month).
- **Decision:** v1 implements product search using DynamoDB FilterExpressions and category/brand GSIs. OpenSearch Serverless is deferred to the backlog and only introduced when DynamoDB filters no longer scale (>5k active SKUs or frequent ad-hoc queries).
- **Rationale:** Keeps v1 inside the free tier (G2) without sacrificing required functionality.
- **Status:** Active

### D-012 — Geographic search: geohash on DynamoDB GSI

- **When:** 2026-05-13
- **Decision:** Branches are indexed by truncated geohash on a GSI; proximity search queries the relevant geohash cells, fetches candidates, then filters by exact distance in memory.
- **Rationale:** Zero additional infra cost; precision is sufficient at kilometer radius; preserves portability (no AWS-managed geo service).
- **Status:** Active

### D-013 — Default LLM provider: Gemini 2.5 Flash-Lite

- **When:** 2026-05-13
- **Context:** Need to pick a default in `llm-kit` for dev/test. Google's Gemini cannot be reached through AWS Bedrock — it ships through Google AI Studio (API key) or Vertex AI (GCP IAM).
- **Decision:** Default LLM in v1 is **Gemini 2.5 Flash-Lite** (latest equivalent of the Flash-Lite line at the time). The `llm-kit` adapter `gemini` calls Google AI Studio by default (simplest auth: API key); a `gemini-vertex` variant is added when GCP IAM is preferred.
- **Rationale:** Cost-efficiency, large context window, strong tool-calling support. Reinforces the multi-cloud posture: the project is not Bedrock-only from day one.
- **Status:** Active. **Validate before M4:** the Gemini model name and pricing tier should be confirmed with current Google docs at implementation time (the "3.1 Flash-Lite" naming the user mentioned does not match any known Google SKU as of project start; we map it to the closest documented model and flag the discrepancy in the design phase).

### D-014 — Communication and artifact languages

- **When:** 2026-05-13
- **Decision:** **All persistent artifacts (code, comments, spec files, infra, docs) are written in English.** Chat between user and agent can stay in Portuguese (PT-BR) without changing this rule.
- **Rationale:** Industry default; future contributors; tooling friction reduction; consistent grep/search.
- **Status:** Active

### D-015 — MVP target stores (5 stores, 7 branches in SP)

- **When:** 2026-05-13
- **Context:** D-004 required ≥ 3 stores with usable public APIs; P-004 was open. The user shared the legacy `StoresSeed.php` (archived at `.specs/research/legacy-stores-seed.md`).
- **Decision:** v1 of the Price Collector ships configurations for **5 stores** — Tenda Atacado, Arena Atacado, Atacadão, Supermercados Pague Menos, Supermercados São Vicente — covering **7 branches** in Sumaré-SP, Americana-SP and Nova Odessa-SP.
- **Rationale:** This set exercises every protocol/shape combination the engine must support in v1:
  - 2 request protocols: `rest-query` (4 stores) and `graphql` (Atacadão)
  - 2 price-variation shapes: `object` (Arena, São Vicente) and `array` (Atacadão)
  - 2 inventory shapes: per-branch list (Tenda) and absent (others)
  - Identifier diversity: SKU+barcode (Tenda), SKU only (most), name-only (Pague Menos)
- **Status:** Active. Closes P-004.

### D-016 — IntegrationConfig schema (renamed from legacy)

- **When:** 2026-05-13
- **Context:** The legacy seed uses Laravel/PHP-shaped field names (`api_search`, `api_products_map_params`, `or_price`, …) that are cryptic and flat.
- **Decision:** The engine's TS `IntegrationConfig` adopts the **renamed, nested** schema documented in `.specs/research/legacy-stores-seed.md` § 2. Key renames: `api_search` → `source.searchUrl`; `api_product_type` → `source.protocol`; `api_products_map_params` → `responseMapping`; `or_price` → `promotionalPrice`; flat `price_variations_*` → nested `priceVariations`; flat `inventory_branch_*` → nested `inventory`.
- **Rationale:** Better cohesion (related fields grouped), clearer intent, type-safe at compile time via Zod schema.
- **Status:** Active. To be materialized in M2 (`price-collector-engine`).

### D-017 — Template placeholder syntax: `{var}` (camelCase, no `$`)

- **When:** 2026-05-13
- **Context:** Legacy uses `{$term}` and `{$branch_id}` (Laravel PHP variable interpolation).
- **Decision:** Engine placeholders use **`{term}` and `{branchId}`** — plain curly braces, camelCase variable names, no `$` sigil.
- **Rationale:** Simpler regex; not coupled to any host language convention; consistent with Mustache-family templates without bringing in a templating library.
- **Status:** Active. The `applyTemplate` operator implements substitution; one variant (`applyTemplateUrlEncoded`) handles the case where substitutions land inside URL-encoded payloads (e.g., Atacadão's GraphQL query string).

### D-019 — Per-package `no-restricted-imports` covers cross-workspace boundary enforcement

- **When:** 2026-05-13
- **Context:** `eslint-plugin-boundaries` v5 `boundaries/element-types` rule resolves imports via `import/resolver`, but in a pnpm monorepo with symlinks it does not reliably classify `@donaoferta/*` package-name imports against the configured element types. Reverse-violation test (file under `packages/core-kernel/src/` importing `@donaoferta/ports`) does not fire `boundaries/element-types` even with `eslint-import-resolver-typescript` configured.
- **Decision:** Keep `boundaries/element-types` enabled (it still catches **relative-path** cross-folder imports) and complement it with per-package `no-restricted-imports` regex patterns:
  - `core-kernel/**` forbids any `@donaoferta/*` import.
  - `ports/**` forbids `@donaoferta/(?!core-kernel(/|$)).*`.
  - `*-kit/**` forbids `@donaoferta/(?!core-kernel|ports|.*-kit)(.*)`.
- **Rationale:** Two-layer defense is acceptable and arguably stronger; the wording in T9 done-when ("fails with boundaries/element-types") becomes "fails with the architectural-boundary ESLint rule" — semantically equivalent (functional behavior: lint fails on the violation). `tools/check-deps.ts` (T10) adds a third layer guarding `package.json` drift.
- **Status:** Active. **Revisit if** boundaries plugin gains first-class pnpm-workspace support, or if a custom resolver eliminates the need for the regex layer.

### D-018 — Root `engines.node` relaxed to `>=20.19.0` (dev convenience)

- **When:** 2026-05-13
- **Context:** Original spec/design pinned `engines.node: "22.x"` (Lambda `nodejs22.x` target, D-002). At the start of Execute the developer machine had Node 20.19.6 only, and installing Node 22 was deferred.
- **Decision:** Root `package.json` declares `engines.node: ">=20.19.0"` while `.nvmrc` still pins `22` as the aspirational target. CI/Lambda will pin Node 22 explicitly when `infra-terraform-base` lands.
- **Rationale:** Keeps local development unblocked without lying about the production runtime. The `.nvmrc` remains authoritative for "what you should use"; `engines` becomes the minimum-acceptable floor for local dev.
- **Status:** Active. **Revisit before M0 ships** — once contributors are on Node 22, tighten `engines.node` back to `22.x` to fail-fast for older runtimes per the spec edge case.

---

## Pending decisions (gray areas)

### P-005 — Anti-bot / WAF mitigation strategy for target store APIs

- **Opened:** 2026-05-13
- **Context:** The legacy seed (archived at `.specs/research/legacy-stores-seed.md`) revealed that all target stores expose **unofficial** endpoints used by their own front-ends. At least two store families sit behind WAFs (Carrefour/Atacadão; SFCC/Demandware for Arena and São Vicente). AWS Lambda egress IPs may be flagged, and requests may be challenged with 403/429 or HTML interstitials.
- **Action:** During the M2 design (`price-collector-engine`), run a measured spike: `curl` each endpoint from (a) developer laptop and (b) a throwaway AWS Lambda in `us-east-1`/`sa-east-1`. Record success rate, headers required, observed rate limits. Based on findings, decide between: (1) plain HTTP with respectful UA + retry/backoff, (2) request signing/cookies, (3) egress through a NAT proxy (small EC2 with rotating IP), (4) third-party scraping API as a fallback per-store. Strong preference for option (1) — escalate to (3)/(4) only if data shows it's required.
- **Owner:** technical spike at the start of M2 design; user approves cost trade-off if proxying is required.

### P-006 — Product canonicalization strategy when identifiers are absent

- **Opened:** 2026-05-13
- **Context:** Across the 5 target stores: only Tenda exposes both SKU and barcode; most expose only SKU; Pague Menos exposes neither. Cross-store product matching is impossible without a stable identifier.
- **Proposed default:** A two-tier canonicalization:
  1. **Strong match** — `(barcode)` if present, else `(storeId, sku)` if present. Treats different stores' SKUs as distinct products.
  2. **Weak match** — normalized `(brand, name)` fingerprint to merge same products across stores when no strong identifier is shared. Manual override table for known equivalences.
- **Action:** Design `lookupOrCreateProduct` operator with both tiers; expose the weak-match confidence in the `Offer` so the API/MCP can surface "exact" vs "fuzzy" matches.
- **Owner:** decision finalised in M2 design.

---

## Resolved decisions (history)

| ID                                  | Resolved on | Resolution                                                                                             |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| P-001 (OpenSearch Serverless in v1) | 2026-05-13  | Resolved as **D-011** — not in v1                                                                      |
| P-002 (Geo search engine)           | 2026-05-13  | Resolved as **D-012** — geohash on DynamoDB                                                            |
| P-003 (Default LLM provider)        | 2026-05-13  | Resolved as **D-013** — Gemini Flash-Lite via Google AI Studio                                         |
| P-004 (Target stores for M2 MVP)    | 2026-05-13  | Resolved as **D-015 + D-016 + D-017** — 5 stores documented in `.specs/research/legacy-stores-seed.md` |

---

## Blockers

_None._

---

## Learnings

_None yet._

---

## Deferred ideas

| Idea                                       | Why deferred                         | When to revisit                                            |
| ------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| Scraping plugin (Cheerio / Playwright)     | Public APIs cover v1                 | When a target store offers no API                          |
| Cognito / Clerk for end-user auth          | No client UI in v1                   | When a client app exists                                   |
| OAuth for public MCP                       | API Key is enough for v1             | When MCP spec requires it or we open to a broader audience |
| Step Functions / EventBridge scheduling    | On-demand collection is enough in v1 | M6                                                         |
| Real multi-cloud (GCP adapter)             | No concrete requirement              | When demanded                                              |
| GraphQL gateway                            | REST + MCP cover v1                  | If composed-front use cases appear                         |
| Admin dashboard (UI)                       | CLI/scripts cover v1                 | When the store catalog grows                               |
| OpenSearch Serverless for full-text search | Cost baseline ~US$ 345/month         | When DynamoDB filters no longer scale (>5k active SKUs)    |

---

## Preferences

- **Conversation language:** PT-BR.
- **Artifact language:** English (see D-014).
- **Explanation style:** direct, with explicit trade-offs and cost annotations.
- **Model usage:** heavy tasks (design, brownfield mapping) use a strong reasoning model; validations/state updates can use a faster, cheaper model.

---

## Next session resume hint

> `foundation-monorepo` ✅ Done (merged PR #1).
> Active: specifying `infra-terraform-base` — Lambda handler adapter for `apps/api`, API Gateway HTTP API, Terraform modules (`lambda-fn`, `http-api`, `iam-policy`), stacks (`shared`, `api`), environment `dev`, GitHub Actions CI with OIDC.
> After `infra-terraform-base`: specify `observability-base` — `packages/observability`, pino logger, OpenTelemetry + ADOT, X-Ray.
