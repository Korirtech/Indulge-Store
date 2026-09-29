# Indulge Essentials — Feature & Bug Tracker

## Completed
- [x] Managed React, tRPC, Shopify Storefront, MySQL/TiDB, and OAuth foundation.
- [x] Responsive storefront, product listing/detail, wishlist, cart drawer, and Shopify checkout handoff.
- [x] Bundled editorial homepage image, lazy-loaded shopper routes, accessible cart modal with focus return, and resilient guest browser storage.
- [x] Preview-product purchase safety and guest wishlist persistence.
- [x] Owner/admin-only catalog dashboard for product search, image management, variant pricing, and location-level available stock.
- [x] Server-side Shopify staged image upload and product attachment; Admin API token is never sent to the browser.
- [x] JPG, PNG, and WebP validation, signature checks, 8 MiB file limit, and safe user feedback.
- [x] API, security, architecture, deployment, README, and launch-prerequisite documentation.
- [x] TypeScript check, 27 passing Vitest tests and 1 intentionally skipped live-store check (no configured store/catalog), production build, and browser homepage/cart-dialog keyboard checks.

## Active implementation bugs
- None currently known in the protected catalog dashboard, image management, price editing, or guarded inventory update paths.

## Separate owner-controlled launch setup
Business credentials, catalog choices, policies, and hosting configuration are intentionally not marked as completed implementation tasks. Track them in [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).
