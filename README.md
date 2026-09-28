# Indulge Essentials

A premium, mobile-first Kenyan essentials storefront concept for English-language shopping in Kenyan shillings (KES). The design direction is warm editorial commerce: cream, ink, sage and clay, with a clean mobile shopping flow.

## Current foundation

- React 19 + TypeScript + Tailwind CSS, Vite frontend.
- Express + tRPC backend; Shopify headless storefront adapter and normalized commerce types.
- Managed MySQL/TiDB + Drizzle and Manus OAuth scaffold.
- Shopify is intended to own products, variants, prices, stock, cart and hosted checkout.
- Protected `/admin/product-images` screen for store admins to add JPG, PNG, and WebP product media directly to Shopify; the Admin API token stays server-side.
- Single-vendor launch model; marketplace functionality stays disabled.

## Run / validate

```bash
pnpm check
pnpm test
pnpm build
pnpm shopify:probe
```

The live Shopify probe requires a connected, claimed development store, server-side Shopify storefront token, and at least one active published product with an image and positive price. A passing local typecheck is not proof of live checkout or payment readiness.

## Setup still required

1. Claim the new development store from the project settings and replace the preview product with the real approved catalog.
2. For image uploads, install a Shopify custom app with `write_files` and `write_products` scopes, set `SHOPIFY_ADMIN_ACCESS_TOKEN` as a server secret, and grant the intended owner the `admin` role.
3. Configure Shopify checkout, currency, shipping/tax rules, customer policy pages and a Kenya-supported payment provider.
4. Confirm whether M-Pesa is available through the merchant's configured provider. M-Pesa is not active in this code milestone; never advertise it until the full sandbox/live callback and reconciliation flow is verified.
5. Configure production domain, support contacts, notification services, analytics consent, and all required launch policies.

## Documentation

- [Architecture](./ARCHITECTURE.md)
- [Database model and data ownership](./DATABASE.md)
- [API specification](./API.md)
- [Deployment guide](./DEPLOYMENT.md)
- [Security notes](./SECURITY.md)
- [Testing plan](./TESTING.md)

The original request describes a full commercial platform. This repository is the foundation and first storefront milestone; features not implemented or verified are explicitly called out rather than represented as working production capabilities.
