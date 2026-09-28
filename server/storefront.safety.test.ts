import { describe, expect, it } from "vitest";
import { canPurchaseProduct, isPreviewProduct } from "../client/src/components/store/commerce-display";

const available = { availableForSale: true };
const unavailable = { availableForSale: false };

describe("storefront purchase safety", () => {
  it("recognizes development preview tags without case sensitivity", () => {
    expect(isPreviewProduct({ tags: ["Preview-Only"] })).toBe(true);
    expect(isPreviewProduct({ tags: ["DEVELOPMENT-PREVIEW"] })).toBe(true);
    expect(isPreviewProduct({ tags: ["skincare"] })).toBe(false);
  });

  it("never allows preview products into the purchase flow even if Shopify says available", () => {
    expect(canPurchaseProduct({ tags: ["preview-only"] }, available)).toBe(false);
    expect(canPurchaseProduct({ tags: ["development-preview"] }, available)).toBe(false);
  });

  it("allows only available, non-preview products to be purchased", () => {
    expect(canPurchaseProduct({ tags: ["skincare"] }, available)).toBe(true);
    expect(canPurchaseProduct({ tags: ["skincare"] }, unavailable)).toBe(false);
    expect(canPurchaseProduct({ tags: ["skincare"] })).toBe(false);
  });
});
