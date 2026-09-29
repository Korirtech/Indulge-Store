# Indulge Essentials — Owner Launch Checklist

These items require store-owner credentials, decisions, or real-world verification. They are **not implemented or verified** by the product-image uploader feature.

## Store and catalog
- [ ] Claim/confirm ownership of the Shopify development store.
- [ ] Replace the preview product with the owner-approved assortment, accurate descriptions, variants, prices, images, and stock.
- [ ] Confirm products are active and published to the intended sales channel.

## Admin image uploads
- [ ] Create/install a Shopify custom app with `read_products`, `write_products`, `write_files`, `read_inventory`, `write_inventory`, and `read_locations` scopes.
- [ ] Add its Admin API token as the server-only `SHOPIFY_ADMIN_ACCESS_TOKEN` secret; never expose it through a `VITE_` variable.
- [ ] Grant the intended owner account the `admin` role (WebDev owner bootstrap or approved database operation) and ensure the corresponding Shopify staff user has matching product, file, inventory, and location permissions.

## Hosting and operations
- [ ] Configure the production database, OAuth callback/origin, Storefront token, and any external Forge/storage values for the chosen host.
- [ ] Configure the production domain, customer support contact, email/SMS services, analytics consent, monitoring, backups, and incident ownership.

## Commercial readiness
- [ ] Configure merchant-owned currency, taxes, delivery regions/rates/SLAs, returns/refunds, and order notifications.
- [ ] Configure a Kenya-supported payment provider; verify a sandbox/test purchase and reconciliation before enabling live capture. M-Pesa is not active in application code.
- [ ] Owner-review privacy, terms, shipping/returns, product claims, ingredients, and consumer disclosures.
- [ ] Decide the customer account/order-history strategy and staff/admin access model.
- [ ] Complete an end-to-end test order and document refund and failure handling before launch.
