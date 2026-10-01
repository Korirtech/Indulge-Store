# API Specification

## Runtime contract

The generated application exposes typed tRPC under `/api/trpc`; it is not currently a REST service. Frontend components call the generated `trpc` client. Shopify requests remain server-side in the injected commerce adapter.

## Implemented integration procedures

| Procedure | Type | Input | Output / behavior |
|---|---|---|---|
| `auth.me` | Query | none | Current session user or null |
| `auth.logout` | Mutation | none | Clears the session cookie |
| `commerce.products.list` | Query | `{ first?: number; collectionHandle?: string }` | Normalized `Product[]` |
| `commerce.products.byHandle` | Query | `{ handle: string }` | Normalized `Product`, not-found error if missing |
| `commerce.collections.list` | Query | `{ first?: number }` | Normalized `Collection[]` |
| `commerce.collections.byHandle` | Query | `{ handle: string }` | Normalized `Collection` |
| `commerce.cart.create` | Mutation | `{ lines: { variantId: string; quantity: number }[] }` | Normalized `Cart` |
| `commerce.cart.get` | Query | `{ cartId: string }` | `Cart` or null |
| `commerce.cart.addLines` | Mutation | `{ cartId: string; lines: { variantId: string; quantity: number }[] }` | Updated `Cart` |
| `commerce.cart.updateLines` | Mutation | `{ cartId: string; lines: { lineId: string; quantity: number }[] }` | Updated `Cart`; quantity zero removes a line |
| `commerce.cart.removeLines` | Mutation | `{ cartId: string; lineIds: string[] }` | Updated `Cart` |
| `adminMedia.status` | Query | none | Admin-only; reports whether Shopify Admin API configuration is present without exposing credentials |
| `adminMedia.auditLogs` | Query | `{ limit: 1..100 }` | Admin-only; returns recent dashboard write events, safe snapshots, status, actor display name/internal ID and timestamps; does not expose the actor's open ID |
| `adminMedia.catalog` | Infinite query | `{ query?, cursor? }` | Admin-only; searchable, cursor-paginated Shopify products and store currency |
| `adminMedia.productDetails` | Query | `{ productId }` | Admin-only; first 100 product images and first 250 variants, including location-level available quantities |
| `adminMedia.locations` | Query | none | Admin-only; active Shopify inventory locations |
| `adminMedia.uploadProductImage` | Mutation | `{ productId, fileName, mimeType, altText?, imageBase64 }` | Admin-only; validates JPG/PNG/WebP bytes up to 8 MiB, stages the upload, then attaches it with Shopify Admin GraphQL |
| `adminMedia.updateImageAlt` | Mutation | `{ productId, mediaId, alt }` | Admin-only; updates alt text for a ready image in that product |
| `adminMedia.removeProductImage` | Mutation | `{ productId, mediaId }` | Admin-only; detaches the image from that product and preserves its Shopify Files entry |
| `adminMedia.updateVariantPrice` | Mutation | `{ productId, variantId, price }` | Admin-only; updates one variant price, with a non-negative amount and up to 2 decimal places |
| `adminMedia.setInventory` | Mutation | `{ productId, variantId, locationId, quantity, expectedCurrent, idempotencyKey }` | Admin-only; sets available stock only when Shopify's current value still matches `expectedCurrent`; stale edits return `CONFLICT` |

Normalized storefront commerce contracts are declared in `shared/commerce/types.ts`. Never return raw Shopify GraphQL responses, private tokens, or Admin API credentials to a browser. The dashboard requires a server-only `SHOPIFY_ADMIN_ACCESS_TOKEN` with `read_products`, `write_products`, `write_files`, `read_inventory`, `write_inventory`, and `read_locations`; the Shopify staff user also needs matching Admin permissions. Inventory updates use Shopify's `changeFromQuantity` compare-and-set and `@idempotent` directive. Each dashboard mutation must create an audit intent record before contacting Shopify and records only safe error codes, not raw provider error text. The audit query is capped at 100 records.

## Planned domain API (not yet implemented)

These are future operations; every mutation needs Zod validation, server authorization, ownership checks, and tests.

| Domain | Planned operation | Authorization / rule |
|---|---|---|
| Customer profile | `account.profile.get/update` | Authenticated owner only |
| Addresses | `account.addresses.list/create/update/delete` | Authenticated owner only; validate Kenyan phone and delivery fields |
| Wishlist | `wishlist.list/add/remove` | Guest local persistence initially; account persistence later |
| Orders | `orders.list/detail/track` | Owner-scoped; authoritative status from Shopify/provider |
| Reviews | `reviews.submit/report` | Purchase verification and moderation server-side |
| Returns | `returns.request/status` | Owner-scoped, eligible order line only |
| Support | `support.tickets.create/list/reply` | Owner-scoped; staff operations have separate permissions |
| Remaining catalog lifecycle | `admin.products.create/archive`, bulk import/export | Administrator, backend-enforced; update prices/media already exists for existing products |
| Orders/promotions | `admin.orders.update`, promotion management | Manager/admin with audit trail and Shopify synchronization rules |
| M-Pesa provider | `payments.mpesa.request`, `payments.mpesa.callback` | Disabled until credentials, callback URL, provider review and idempotency/reconciliation tests are configured |

The brief's REST examples (`GET /api/products`, `POST /api/checkout`, etc.) are conceptual. If third-party REST clients are later required, document versioning, auth, error envelope, rate limits, idempotency keys and webhooks; keep the same server-side domain services as the tRPC API.

## Error behavior

Use tRPC error codes consistently (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`). Customer responses must not reveal secrets, stack traces, SQL statements, or provider credentials. Payment failure state is never inferred from a client-provided status.
