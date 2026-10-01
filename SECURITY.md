# Security Notes

## Security posture for this milestone

The project uses managed Manus OAuth/session, a server-side Shopify Storefront adapter, and catalog-only admin RBAC for the management dashboard. Shopify-hosted checkout owns payment collection. This milestone does not process card data, does not initiate live M-Pesa requests, does not create paid orders in application code, and does not implement the complete RBAC/admin system described in the source brief.

## Required controls

- **Secrets:** Store Shopify, payment, mail and storage secrets in managed server environment settings. Never use `VITE_` for secrets, commit `.env`, log tokens, or return credentials in tRPC output.
- **Checkout:** Redirect to the server-returned Shopify checkout URL. Do not accept client claims that payment succeeded. Use verified provider events/order state and idempotent event processing before any future application-side fulfillment.
- **Authentication:** Keep OAuth callbacks and session-cookie options in the scaffold. All dashboard endpoints compose `protectedProcedure` with the admin-role check: anonymous callers receive `UNAUTHORIZED`, while signed-in non-admins receive `FORBIDDEN`. UI-only hiding is not authorization.
- **Authorization:** Scope customer addresses, orders, returns, reviews and support tickets to the authenticated owner. Store-manager permissions must exclude account/security settings. Seller access is disabled until isolation tests pass.
- **Validation:** Validate inputs on server and client; constrain quantities and identifiers; sanitize any rich text; use parameterized ORM queries; return safe error messages.
- **Abuse protection:** Add rate limits and abuse controls before enabling public registration, contact, review, coupon, or payment endpoints. Avoid revealing whether sensitive account identifiers exist.
- **Catalog dashboard:** Product listing, price changes, inventory changes, image updates, and image detachment are protected by backend `adminProcedure`; hiding the page link is not authorization. The `SHOPIFY_ADMIN_ACCESS_TOKEN` remains server-only, and Shopify scopes plus the staff user's Admin permissions must be least-privilege. Uploaded JPG/PNG/WebP bytes are capped at 8 MiB and checked against their declared MIME signatures before staging through Shopify. Inventory writes re-read the selected variant/location and use a stale-quantity compare-and-set plus Shopify idempotency key. Removing an image detaches it from the selected product but preserves the file in Shopify Files. The app does not persist image bytes in SQL or local disk. Review/quarantine workflows and malware scanning are not implemented.
- **Webhooks:** For any future M-Pesa/payment/courier webhook, verify provider authenticity, event timestamp/replay constraints, idempotency key, amount/currency/order correlation and state-machine transition. Persist audit evidence without logging secrets or unnecessary PII.
- **Data protection:** Collect minimum data, protect PII by role, define retention/export/deletion handling, and avoid storing PAN/card security codes or M-Pesa PINs.
- **Headers/transport:** Use HTTPS, secure/HttpOnly/SameSite cookies as appropriate, restricted CORS, security headers, CSRF safeguards for cookie-authenticated writes, and dependency updates.
- **Audit logging:** Each catalog-dashboard image upload, alt-text edit, image detach, variant price update, and location inventory update first writes a database intent row, then finalizes it as succeeded or failed with actor ID, action, target, timestamp, safe metadata, and relevant before/after values. If the intent row cannot be created, the Shopify mutation is not attempted. If a successful Shopify mutation cannot be finalized in the audit table, the UI receives a warning to verify Shopify before retrying; the row remains visibly in progress.
- **Audit scope and limits:** The API and UI are administrator-only and expose no edit/delete operation for audit records. Audit details omit credentials, raw Shopify error text, image bytes, and open IDs. Only writes made through this dashboard are logged; read-only browsing and direct changes in Shopify Admin are not captured. Retention is indefinite until the owner defines a policy. The database owner can still alter database records, so this is an operational audit trail, not tamper-proof external evidence.

## Launch gates

Do not enable real checkout or advertise M-Pesa until credentials are entered securely, merchant/provider account ownership is verified, callback handling and duplicate/replay/failure cases are tested, reconciliation and refund handling are documented, and a real low-value test transaction is verified. Do not grant the initial account admin rights from a client-controlled field.
