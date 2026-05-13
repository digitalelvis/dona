# Legacy Stores Seed — Reference & Analysis

> Reference material provided by the project owner. **Not** part of the new codebase. Captured here to feed the design of `packages/collector` and the `IntegrationConfig` data model (M2 — `price-collector-engine`).

## Source

Original `database/seeders/StoresSeed.php` from the prior Laravel system. Reproduced verbatim below for traceability, followed by structured analysis.

---

## Raw seed (verbatim)

```php
public function run(): void
{
    $tenda = Store::updateOrCreate(
        ['name' => 'Tenda Atacado'],
        [
        'api_search' => 'https://api.tendaatacado.com.br/api/public/store/search?query={$term}',
        'api_branch' => 'https://api.tendaatacado.com.br/api/public/branch/all',
        'api_config' => json_decode('{
            "api_product_type":"queryString",
            "api_products_map_params":{
                    "sku":"sku",
                    "url": "url",
                    "name":"name",
                    "brand":"brand",
                    "price":"price",
                    "result":"products",
                    "barcode":"barcode",
                    "or_price":null,
                    "thumbnail":"thumbnail",
                    "price_variations":false,
                    "price_variations_type": null,
                    "price_variations_path": null,
                    "price_variations_path_price": null,
                    "price_variations_path_qty": null,
                    "inventory_branch_list":"inventory",
                    "inventory_branch_available": "totalAvailable"
                }
            }')
    ]);
    $tenda->branches()->updateOrCreate(
        ['name' => 'Tenda Atacado - Sumaré'],
        [
        'address' => 'Rua Francisco Manoel de Souza, 64',
        'neighborhood' => 'Chácara Bela Vista',
        'city' => 'Sumaré',
        'state' => 'SP',
        'latitude' => '-22.8073457',
        'longitude' => '-47.2518429',
        'maps_url' => 'https://maps.app.goo.gl/8pZLfEAhynZVpjpb8',
    ]);

    $arena = Store::updateOrCreate(
        ['name' => 'Arena Atacado'],
        [
        'api_search' => 'https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/SearchServices-GetSuggestionsJson?q={$term}',
        'api_branch' => 'https://www.arenaatacado.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Stores-AvailableStores',
        'api_offers' => null,
        "api_config" => json_decode('{
              "api_product_type":"queryString",
              "api_products_map_params":{
                "sku":"productTileModel.sku",
                 "url":"productTileModel.productShowFullUrl",
                 "name":"productTileModel.productName",
                 "brand":"productTileModel.brand",
                 "price":"productTileModel.price.list.value",
                 "result":"suggestions.product.products",
                 "barcode":null,
                 "or_price":"productTileModel.price.sales.value",
                 "thumbnail":"productTileModel.images.medium.url",
                 "price_variations":true,
                 "price_variations_type": "object",
                 "price_variations_path":"productTileModel.price.tiers",
                 "price_variations_path_price":"price.sales.value",
                 "price_variations_path_qty":"quantity",
                 "inventory_branch_list":null,
                 "inventory_branch_available":"productTileModel.available"
              }
        }'),
    ]);
    $arena->branches()->updateOrCreate(
        ['name' => 'Arena Atacado - Sumaré'],
        [
        'address' => 'Av. João Argenton, 2001',
        'neighborhood' => 'Vila Santana',
        'city' => 'Sumaré',
        'state' => 'SP',
        'latitude' => '-22.8123985',
        'longitude' => '-47.2793086',
        'maps_url' => 'https://maps.app.goo.gl/UQMF6dadkwQLfbca7',
    ]);

    $atacadao = Store::updateOrCreate(
        ['name' => 'Atacadão'],
        [
        'api_search' => 'https://www.atacadao.com.br/api/graphql?operationName=ProductsQuery&variables=%7B%22first%22%3A20%2C%22after%22%3A%220%22%2C%22sort%22%3A%22score_desc%22%2C%22term%22%3A%22{$term}%22%2C%22selectedFacets%22%3A%5B%7B%22key%22%3A%22region-id%22%2C%22value%22%3A%22U1cjYXRhY2FkYW9icjczNg%3D%3D%22%7D%2C%7B%22key%22%3A%22channel%22%2C%22value%22%3A%22%7B%5C%22salesChannel%5C%22%3A%5C%221%5C%22%2C%5C%22seller%5C%22%3A%5C%22{$branch_id}%5C%22%2C%5C%22regionId%5C%22%3A%5C%22U1cjYXRhY2FkYW9icjczNg%3D%3D%5C%22%7D%22%7D%2C%7B%22key%22%3A%22locale%22%2C%22value%22%3A%22pt-BR%22%7D%5D%7D',
        'api_branch' => 'https://apihub.carrefour.com.br/br-atc-api-middleware-flyer-services/api/v2/Store/city?uf=SP&PageSize=24&pageNumber=1&api-version=2',
        'api_config' => json_decode('{
            "api_product_type":"graphql",
            "api_products_map_params":{
                    "sku":"node.sku",
                    "url": null,
                    "name":"node.name",
                    "brand":"node.brand.name",
                    "price":"node.offers.highPrice",
                    "result":"data.search.products.edges",
                    "barcode":null,
                    "or_price":"node.offers.lowPrice",
                    "thumbnail":"node.image.url",
                    "price_variations":true,
                    "price_variations_type": "array",
                    "price_variations_path":"node.offers.offers",
                    "price_variations_path_price":"price",
                    "price_variations_path_qty":"minQuantity",
                    "inventory_branch_list":null,
                    "inventory_branch_available":"productTileModel.available"
                }
            }')
    ]);
    $atacadao->branches()->updateOrCreate(
        ['name' => 'Atacadão - Sumaré'],
        [
        'branch_id' => 'acatadaobr736',
        'address' => "Rod. Virgínia Viel Campo Dall'Orto, s/n",
        'neighborhood' => 'Chácara Monte Alegre',
        'city' => 'Sumaré',
        'state' => 'SP',
        'latitude' => '-22.8014636',
        'longitude' => '-47.2372163',
        'maps_url' => 'https://maps.app.goo.gl/YSsB4ovZ2r5UNAZq9'
    ]);
    $atacadao->branches()->updateOrCreate(
        ['name' => 'Atacadão - Americana'],
        [
        'branch_id' => 'acatadaobr625',
        'address' => "R. São Gabriel, 2451 ",
        'neighborhood' => 'Jardim Sao Vito',
        'city' => 'Americana',
        'state' => 'SP',
        'latitude' => '-22.727654',
        'longitude' => '-47.29617',
        'maps_url' => 'https://maps.app.goo.gl/6y2YErbMj8GxsGC59',
    ]);

    $pm = Store::updateOrCreate(
        ['name' => 'Supermercados Pague Menos'],
        [
        'api_search' => 'https://www.superpaguemenos.com.br/busca/suggest/?query_term={$term}',
        'api_branch' => '',
        'api_config' => json_decode('{
            "api_product_type":"queryString",
            "api_products_map_params":{
                    "sku":null,
                    "url": null,
                    "name":"name",
                    "brand":null,
                    "price":"price",
                    "result":"result_list",
                    "barcode":null,
                    "or_price":null,
                    "thumbnail":null,
                    "price_variations":false,
                    "price_variations_type": null,
                    "price_variations_path": null,
                    "price_variations_path_price": null,
                    "price_variations_path_qty": null,
                    "inventory_branch_list":null,
                    "inventory_branch_available": null
                }
            }')
    ]);
    $pm->branches()->updateOrCreate(
        ['name' => 'Supermercados Pague Menos - Nova Odessa'],
        [
        'branch_id' => null,
        'address' => "Endereço: Av. Ampélio Gazzetta, 1800",
        'neighborhood' => 'Jardim Santa Rosa',
        'city' => 'Nova Odessa',
        'state' => 'SP',
        'latitude' => '-22.7915668',
        'longitude' => '-47.2943153',
        'maps_url' => 'https://maps.app.goo.gl/9pdqtpqbU62ywJLZ7'
    ]);

    $sv = Store::updateOrCreate(
        ['name' => 'Supermercados São Vicente'],
        [
        'api_search' => 'https://www.svicente.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/SearchServices-GetSuggestionsJson?q={$term}',
        'api_branch' => 'https://www.svicente.com.br/on/demandware.store/Sites-Arena-Site/pt_BR/Stores-AvailableStores',
        'api_offers' => null,
        "api_config" => json_decode('{
              "api_product_type":"queryString",
              "api_products_map_params":{
                "sku":"productTileModel.sku",
                 "url":"productTileModel.productShowFullUrl",
                 "name":"productTileModel.productName",
                 "brand":"productTileModel.brand",
                 "price":"productTileModel.price.list.value",
                 "result":"suggestions.product.products",
                 "barcode":null,
                 "or_price":"productTileModel.price.sales.value",
                 "thumbnail":"productTileModel.images.medium.url",
                 "price_variations":true,
                 "price_variations_type": "object",
                 "price_variations_path":"productTileModel.price.tiers",
                 "price_variations_path_price":"price.sales.value",
                 "price_variations_path_qty":"quantity",
                 "inventory_branch_list":null,
                 "inventory_branch_available":"productTileModel.available"
              }
        }'),
    ]);
    $sv->branches()->updateOrCreate(
        ['name' => 'Supermercados São Vicente - Nova Odessa'],
        [
        'address' => 'Av. Ampélio Gazzetta, 2799',
        'neighborhood' => 'Parque Industrial Harmonia',
        'city' => 'Nova Odessa',
        'state' => 'SP',
        'latitude' => '-22.7856349',
        'longitude' => '-47.3015937',
        'maps_url' => 'https://maps.app.goo.gl/bEBQ8W1PWiXNBBfp9',
    ]);
}
```

---

## Structured analysis

### 1. Target stores (MVP candidate set)

| # | Store name | Brand family | Geography in seed | Notes |
|---|---|---|---|---|
| 1 | **Tenda Atacado** | Wholesale (Tenda) | Sumaré-SP | Cleanest API (`api.tendaatacado.com.br/api/public/...`); per-branch inventory exposed |
| 2 | **Arena Atacado** | Wholesale (Arena, IRB) | Sumaré-SP | Salesforce Commerce Cloud (Demandware) suggestion endpoint; price-tier `object` |
| 3 | **Atacadão** | Wholesale (Carrefour Group) | Sumaré-SP + Americana-SP | **GraphQL** via `atacadao.com.br/api/graphql`; branches via Carrefour `apihub`; price-tier `array`; **branch-aware request** |
| 4 | **Supermercados Pague Menos** | Retail (regional) | Nova Odessa-SP | Minimal "suggest" endpoint; very few fields mapped (no SKU, no barcode, no thumbnail) |
| 5 | **Supermercados São Vicente** | Retail (regional) | Nova Odessa-SP | Same Salesforce Commerce Cloud shape as Arena Atacado |

**MVP set for M2** (≥3 required by D-004): **all five** make a strong MVP because they exercise every protocol class in the data:

- REST + simple JSON (Tenda, Pague Menos)
- REST + SFCC-shaped JSON (Arena, São Vicente)
- GraphQL (Atacadão)

Picking these five also gets us **2 protocol dispatches** (`queryString` / `graphql`) and **2 price-variation shapes** (`object` / `array`) covered in v1 — which is exactly what the engine must validate.

### 2. `IntegrationConfig` schema, derived

The seed effectively defines the engine's config shape. Re-expressed in our (target TS) vocabulary:

```ts
type IntegrationConfig = {
  storeId: StoreId;
  source: {
    protocol: "rest-query" | "graphql";         // was `api_product_type` (renamed: clearer)
    searchUrl: string;                          // was `api_search`. Contains `{term}` placeholder, may contain `{branchId}`
    branchListUrl: string | null;               // was `api_branch`
    offersUrl?: string | null;                  // was `api_offers` (rarely used; future)
    auth?: AuthConfig | null;                   // not in legacy seed (no auth needed), reserved
    headers?: Record<string, string>;           // not in legacy seed, reserved
  };
  responseMapping: {
    productListPath: string;                    // was `result` — JSONPath to the array of products
    productFields: {
      sku: string | null;                       // JSONPath, relative to one product item
      barcode: string | null;
      name: string | null;
      brand: string | null;
      url: string | null;
      thumbnail: string | null;
      price: string | null;                     // "list" / "regular" price
      promotionalPrice: string | null;          // was `or_price` — promotional/sale price ("or" = "of_promo"? unclear, renamed)
    };
    priceVariations: {
      enabled: boolean;
      shape: "object" | "array" | null;         // was `price_variations_type`
      listPath: string | null;                  // was `price_variations_path`
      pricePath: string | null;                 // was `price_variations_path_price`
      qtyPath: string | null;                   // was `price_variations_path_qty`
    };
    inventory: {
      listPath: string | null;                  // was `inventory_branch_list`
      availabilityPath: string | null;          // was `inventory_branch_available`
    };
  };
  cachePolicy?: {
    ttlSeconds: number;                         // not in legacy, our addition
    staleWhileRevalidateSeconds?: number;
  };
};
```

**Renames applied** to remove Laravel-shaped naming and improve clarity:

| Legacy field | New field | Why |
|---|---|---|
| `api_product_type` | `source.protocol` | "product type" was misleading — it's the request protocol |
| `api_search`, `api_branch`, `api_offers` | `source.searchUrl`, `source.branchListUrl`, `source.offersUrl` | Less cryptic, all under `source.` for cohesion |
| `api_products_map_params` | `responseMapping` | What it actually is |
| `result` | `productListPath` | Says what it is |
| `or_price` | `promotionalPrice` | `or_` was opaque |
| `price_variations_*` (5 flat fields) | nested `priceVariations` object | Cohesion |
| `inventory_branch_*` (2 flat fields) | nested `inventory` object | Cohesion |

### 3. Template placeholder syntax

Legacy uses `{$term}` and `{$branch_id}` (Laravel-style PHP variable interpolation). For our engine we'll use **simpler curly placeholders**: `{term}`, `{branchId}` (no `$`, camelCase). The engine's `applyTemplate` operator does the substitution. Supported variables:

| Placeholder | Bound from | Required? |
|---|---|---|
| `{term}` | search query coming from API / MCP | yes (every store has it) |
| `{branchId}` | branch's `externalId` field (when set) | only when integration declares it |

Atacadão's URL also contains URL-encoded JSON with nested base64-like values (`U1cjYXRhY2FkYW9icjczNg==` = base64 of `SW#atacadaobr736`). We do **not** decode these at the engine level — they're treated as opaque strings. The store's `IntegrationConfig` carries the encoded form; if it ever changes, you re-encode and update the config.

### 4. Branch data model derived

```ts
type Branch = {
  id: BranchId;                       // our internal id
  storeId: StoreId;
  externalId: string | null;          // was `branch_id` (used in URL templates by Atacadão)
  name: string;
  address: {
    street: string;                   // was `address`
    neighborhood: string;
    city: string;
    state: string;                    // 2-letter UF
  };
  geo: GeoPoint;                      // { lat: number; lng: number } — was `latitude`/`longitude` (strings in seed; we'll store numbers)
  mapsUrl?: string;
};
```

Note: legacy stores `latitude` / `longitude` as **strings**. We'll coerce to `number` at the boundary and round to 7 decimals (≈ 1 cm precision, more than enough; reduces DynamoDB attribute size). Geohash is derived (not stored as a field on the Branch; computed by the repository before writing to the GSI).

### 5. Engine operators required for MVP

Derived from the five stores in the seed:

| Operator | Purpose | First used by |
|---|---|---|
| `applyTemplate` | Substitute `{term}`, `{branchId}` in URL/body | All stores |
| `httpGet` | Perform GET with optional headers and timeout | All "queryString" stores |
| `httpGraphQL` | Perform GET/POST with GraphQL operation | Atacadão |
| `parseJson` | Parse response body | All stores |
| `jsonPathArray` | Resolve `productListPath` → array of items | All stores |
| `jsonPathScalar` | Resolve scalar paths from one item (sku, name, price…) | All stores |
| `expandPriceVariations` | Walk `priceVariations.listPath`, emit (qty, price) tuples | Arena, Atacadão, São Vicente |
| `expandInventory` | Walk `inventory.listPath`, emit per-branch availability | Tenda |
| `normalizeMoney` | Coerce numbers like `12.34`, `"12,34"`, `"R$ 12,34"` into cents | All stores |
| `assembleOffer` | Build the canonical `Offer` value object | All stores |

The fact that **two operators** (`expandPriceVariations`, `expandInventory`) cover the two structural "expansion" shapes in the legacy data is reassuring — these are the only "loops" in the pipeline; everything else is straight mapping.

### 6. Canonical `Offer` shape the engine emits

```ts
type Offer = {
  storeId: StoreId;
  branchId: BranchId;                 // resolved by the engine
  productExternalRef: {               // identifying info from the source
    sku: string | null;
    barcode: string | null;
    name: string;                     // always present
    url: string | null;
  };
  product: {
    canonicalId: ProductId;           // resolved by lookupOrCreateProduct
    name: string;
    brand: string | null;
    thumbnailUrl: string | null;
  };
  price: {
    listCents: number;                // price in cents (integer)
    promotionalCents: number | null;
    variations: Array<{               // empty when none
      minQuantity: number;
      priceCents: number;
    }>;
  };
  availability: {
    available: boolean;
    inStockCount: number | null;
  } | null;                           // null when source doesn't expose
  collectedAt: Date;
  rawSnapshotKey?: string;            // optional S3 pointer (M5+) for audit
};
```

This is the de-facto contract of the `domain-catalog` `Offer` entity that M2 will materialize.

---

## Risks identified from the seed

1. **Unofficial APIs (HIGH).** None of these endpoints is contractual. They are the same JSON endpoints the stores' own front-ends consume. They can change without notice. Mitigations to bake into M2:
    - Strict schema validation at the response boundary (Zod). On mismatch, log structured error + fall back to last-known good cached value.
    - Per-store SLO + alert (e.g., "Atacadão integration error-rate > 5 % over 10 min").
    - `IntegrationConfig` updates as **data**, not code — fixing a broken store is editing a DynamoDB item.

2. **Anti-bot / WAF (MEDIUM–HIGH).** Multiple stores (Atacadão via Carrefour, Arena/SV via SFCC) are behind Cloudflare or similar. Possible failure modes:
    - 403/429 with HTML challenge pages.
    - User-Agent and accept-language sensitivity.
    - IP reputation (AWS Lambda IP pools may be flagged).
   Mitigations to consider in M2 design: respectful `User-Agent`, request rate limiter per store, optional egress through a proxy (Pulumi/Squid on a small EC2 NAT) — but **only if necessary**. Re-evaluate after first real measurements.

3. **GraphQL request encoding (MEDIUM).** Atacadão embeds URL-encoded JSON in the query string with nested encoded values. Our `applyTemplate` operator must be careful: do **not** URL-encode `{term}` and `{branchId}` substitutions if they're going into an already-encoded blob. We need a `urlEncoded: boolean` flag on the placeholder, or two operators (`applyTemplate` for plain strings vs `applyTemplateUrlEncoded`).

4. **Inconsistent product identity (MEDIUM).** Only Tenda has both `sku` and `barcode`. Atacadão has only `sku`. Pague Menos has neither. Our `lookupOrCreateProduct` operator needs a graceful fallback (canonicalize by `(name, brand)` when no identifier is present), accepting that products from Pague Menos may not be cross-store-comparable in v1.

5. **Price normalization (LOW–MEDIUM).** All seed examples show price as already-numeric in the JSON. But real responses can drift to strings like `"12,34"`. `normalizeMoney` must handle: number / numeric string / Brazilian decimal (`,`) / `"R$ 12,34"`. Always emit integer cents.

6. **Geographic concentration (LOW).** Seed covers only Sumaré-SP, Americana-SP, Nova Odessa-SP. v1's geo search will be exercised in a small region; expansion stores must be onboarded later. Not a blocker, just a known limitation for QA.

---

## Recommendations for downstream features

- **M1 (`stores-catalog`)** — Use the Store/Branch shapes above. Add a `seed` fixture file containing the 5 stores + 7 branches (without the `IntegrationConfig` — that lives in M2).
- **M2 (`price-collector-engine`)** — `IntegrationConfig` schema as in §2 above. Operators as in §5. Tests must include one fixture per protocol (rest-query + graphql) and one fixture per price-variation shape (object + array). Risk #1 and #3 above must be addressed before declaring M2 done.
- **Tests for the engine**: ship the 5 real responses (anonymized if needed) as test fixtures in `packages/collector/test/fixtures/`. Recording them now (a one-time `curl` per endpoint) gives us regression coverage.
