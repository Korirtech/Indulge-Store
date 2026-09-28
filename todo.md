# Indulge Essentials — Build Checklist

## Completed in this preview milestone
- [x] Managed full-stack React, tRPC, and Shopify Storefront API foundation
- [x] Kenyan shilling (KES) catalog pricing and hosted Shopify checkout pathway
- [x] Premium responsive home, shop, product, wishlist, account-notice, and information pages
- [x] Live product listing, client-side search, department filter, sort controls, and empty/error states
- [x] Guest wishlist persistence in the current browser
- [x] Cart drawer with quantity changes, removal, and Shopify checkout handoff for eligible real products
- [x] Original homepage and product imagery hosted in managed storage / Shopify CDN
- [x] Product-preview safety: development-preview products are clearly labeled and blocked from checkout
- [x] Project architecture, API, database, security, deployment, and testing notes
- [x] TypeScript and production build verified; Vitest suite passes

## Required before commercial launch
- [ ] Replace the clearly marked preview listing with the owner-approved product assortment, prices, images, variants, and stock
- [ ] Configure an eligible Kenya payment provider (e.g. M-Pesa and/or Paystack) in the Shopify store; credentials and merchant onboarding are not present in this project
- [ ] Confirm tax treatment, delivery areas/rates/SLAs, return/refund policy, and customer-support contact details
- [ ] Finalize and owner-review privacy notice, terms, product claims, ingredients, and consumer disclosures
- [ ] Configure customer account/order-history strategy and an owner-approved staff/admin access model
- [ ] Configure the custom domain, canonical URL, production sitemap, analytics consent, and social profile links
- [ ] Run an end-to-end test order using an approved test payment method before enabling live payment capture
- [ ] Claim/confirm ownership of the generated Shopify development store through project settings

## Known limitations / intentional preview states
- Only one illustrative development product is seeded; it is tagged `preview-only` and cannot be added to cart.
- No real payment, shipping, customer account, newsletter, review, or store-contact integration is active yet.
- Store policy pages are honest launch placeholders, not final legal or service promises.
- Wishlist data is stored in browser localStorage and is not synchronized across devices.
