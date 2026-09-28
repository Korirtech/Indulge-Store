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

Normalized frontend commerce contracts are declared in `shared/commerce/types.ts`. Never return raw Shopify GraphQL `edges/nodes`, private tokens, or Admin API responses to a browser.

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
| Admin catalog | `admin.products.create/update/archive` | Store manager or administrator, backend-enforced |
| Admin inventory/orders | `admin.inventory.adjust`, `admin.orders.update` | Manager/admin with audit trail and Shopify synchronization rules |
| M-Pesa provider | `payments.mpesa.request`, `payments.mpesa.callback` | Disabled until credentials, callback URL, provider review and idempotency/reconciliation tests are configured |

The brief's REST examples (`GET /api/products`, `POST /api/checkout`, etc.) are conceptual. If third-party REST clients are later required, document versioning, auth, error envelope, rate limits, idempotency keys and webhooks; keep the same server-side domain services as the tRPC API.

## Error behavior

Use tRPC error codes consistently (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`). Customer responses must not reveal secrets, stack traces, SQL statements, or provider credentials. Payment failure state is never inferred from a client-provided status.
