# Contributing

1. Confirm the feature scope and data owner before changing commerce behavior.
2. Keep Shopify API access in the existing server adapter; frontend code uses `trpc.commerce.*` and normalized types only.
3. Validate mutations on the server, add authorization for customer/staff data, and never trust client prices or payment status.
4. Add or update tests for normal, empty, failure, and duplicate-request paths.
5. Run `pnpm check`, `pnpm test`, and `pnpm build` before proposing a change. For Shopify data changes, run the live probe only after store setup is complete.
6. Do not commit `.env`, credentials, customer data, or product imagery without usage rights.
7. Keep marketplace, real payments and production launch flags disabled until their security and operational gates are met.
