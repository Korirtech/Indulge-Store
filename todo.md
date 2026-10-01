# Indulge Essentials — Feature & Bug Tracker

## Completed
- [x] Managed React, tRPC, Shopify Storefront, MySQL/TiDB, and OAuth foundation.
- [x] Responsive storefront, product listing/detail, wishlist, cart drawer, and Shopify checkout handoff.
- [x] Preview-product purchase safety and guest wishlist persistence.
- [x] Owner/admin-only catalog dashboard for product search, image management, variant pricing, and location-level available stock.
- [x] Dashboard authentication and RBAC: OAuth session required; every admin endpoint checks the server-side `admin` role; anonymous and regular-user access tests cover all procedures.
- [x] Durable admin audit trail for dashboard mutations with before/after snapshots, success/failure state, actor identity, safe error codes, and an admin-only recent-history panel.
- [x] Server-side Shopify staged image upload and product attachment; Admin API token is never sent to the browser.
- [x] JPG, PNG, and WebP validation, signature checks, 8 MiB file limit, and safe user feedback.
- [x] API, security, database, architecture, deployment, README, and launch-prerequisite documentation.
- [x] TypeScript check, 29 passing Vitest tests (1 intentionally skipped), live Shopify smoke checks, production build, and desktop/mobile route access-gate review.

## Active implementation bugs
- None currently known in the protected catalog dashboard, audit trail, image management, price editing, or guarded inventory update paths.

## Separate owner-controlled launch setup
Business credentials, catalog choices, policies, and hosting configuration are intentionally not marked as completed implementation tasks. Track them in [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md).
