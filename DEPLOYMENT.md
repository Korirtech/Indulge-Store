# Deployment Guide

## Current hosting topology

This project runs in the managed WebDev environment with a Vite/React storefront, Node/Express/tRPC server, managed MySQL/TiDB database, Manus OAuth, managed object storage, and Shopify Storefront API integration. HTTPS and the preview edge are supplied by the platform. Production behavior is request-based/serverless; do not assume a persistent worker or in-memory queue survives requests.

## Local / preview checks

From the project directory:

```bash
pnpm check
pnpm test
pnpm build
pnpm shopify:probe
```

The Shopify probe needs a configured store domain and Storefront API access token and will fail/skip when those are absent, as described in the integration guide. Cart testing needs at least one published product with an available variant.

## Environment variables

Set secrets through project secrets/settings, never in frontend code, source control, or terminal output. Values beginning with `VITE_` are public; never place secrets there.

- Managed platform: `DATABASE_URL`, `JWT_SECRET`, Manus OAuth values, built-in storage/API environment supplied by the runtime.
- Shopify server: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_API_ACCESS_TOKEN` (server-side only).
- Optional future M-Pesa: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, and a Daraja environment/sandbox selector. Do not add live values until callback URL ownership and merchant credentials are confirmed.
- Public metadata: `NEXT_PUBLIC_APP_URL` in the original brief is framework-specific and not used by this Vite scaffold; use the managed public site URL or a documented Vite public variable where required.

See `.env.example` for safe placeholders only.

## Go-live checklist

1. Claim/verify the newly provisioned Shopify development store through project settings; replace the preview product with the owner's approved, accurately described catalog and image assets.
2. Confirm products are active, priced in the intended currency, stocked, and published to the Manus storefront channel; run `pnpm shopify:probe` and test add/update/remove cart operations.
3. Configure Shopify checkout, shipping zones, tax behavior, order notifications, returns policy, and a Kenya-supported payment method. M-Pesa availability must be confirmed in the merchant's Shopify/provider settings; do not advertise it until a sandbox/live payment is verified.
4. Configure domain, contact details, privacy/terms/returns/shipping pages, email/SMS providers, analytics consent, backups, monitoring and alert ownership.
5. Run `pnpm check`, all tests, responsive/accessibility checks, payment failure tests, order reconciliation and a low-value end-to-end sandbox purchase.
6. Set production secrets in managed project settings, publish a checkpoint, deploy through the platform's publish flow, then verify HTTPS, health, catalog, checkout and callback behavior in production.
7. Keep rollback instructions and store/database backup ownership documented.

## Important limitation

This project is not production-ready for real payments solely because it builds or renders. Real payment acceptance, M-Pesa, inventory reconciliation, shipping rates, notifications, admin operations and launch compliance each require provider configuration, credentials and end-to-end verification.
