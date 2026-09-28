# Testing Plan

## Automated checks in the repository

- `pnpm check` — TypeScript compile check.
- `pnpm test` — Vitest suite, including the scaffold auth logout test, Shopify commerce tests, and the live Shopify smoke test when credentials/catalog are present.
- `pnpm build` — production bundle and Node server build.
- `pnpm shopify:probe` — optional live normalized-catalog probe; requires an active published product with title, image and positive price.

Record actual command results in the delivery summary; do not equate a skipped live smoke test with a passed live integration.

## Manual storefront acceptance

1. Load `/` on desktop and mobile; check logo/navigation, search field, category links, hero CTA and footer.
2. Search for the preview item by title; verify no-result and matching-result states.
3. Open the product; check image alt text, price/currency, availability, quantity control and disabled state for unavailable product.
4. Add to cart; verify cart opens, item count and subtotal match the server-returned cart.
5. Increase/decrease quantity and remove the item; reload to verify local cart ID rehydrates where supported.
6. Start checkout; confirm navigation uses Shopify's returned hosted URL and that no application screen claims payment success.
7. Test empty cart, product unavailable, network error, stale cart ID and repeated add/remove interactions.
8. Test keyboard focus, visible focus rings, labels, contrast, reduced motion, narrow 320px layout, 375px, 414px, 768px, 1024px, 1280px and 1440px+.

## Production commerce tests (not completed until credentials are configured)

- Checkout payment success, decline, cancellation, timeout, refresh, duplicated callback, replayed callback, amount/currency mismatch and provider outage.
- Inventory race/oversell prevention, price changed mid-checkout, unavailable variant, duplicate order submit, duplicate/expired coupon, partial refund, cancellation and return state history.
- Verify server-side paid state from authoritative Shopify/provider records only; reconcile totals and fulfillment state.
- Customer isolation for profile, addresses, wishlist, orders, returns and support; staff role boundaries; seller tenant isolation if marketplace is enabled.
- Upload type/size validation and permissions; XSS/input abuse; rate limits; secret/log review; accessibility and performance checks.

## Current status

The detailed store brief defines a far broader release gate than a first storefront milestone. Until the checks above are executed with an approved catalog, Shopify configuration, payment credentials, shipping policy and support operations, mark real payments and production readiness as **not verified**.
