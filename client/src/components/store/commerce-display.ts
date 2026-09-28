import type { Product, ProductVariant } from "@shared/commerce/types";

export function isPreviewProduct(product: Pick<Product, "tags">): boolean {
  return product.tags.some(tag => {
    const normalized = tag.toLowerCase();
    return normalized === "preview-only" || normalized === "development-preview";
  });
}

export function canPurchaseProduct(
  product: Pick<Product, "tags">,
  variant?: Pick<ProductVariant, "availableForSale">
): boolean {
  return Boolean(variant?.availableForSale) && !isPreviewProduct(product);
}
