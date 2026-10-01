import { z } from "zod";
import {
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
  getAdminProductDetails,
  isShopifyAdminConfigured,
  listAdminLocations,
  listAdminProducts,
  MAX_PRODUCT_IMAGE_BASE64_LENGTH,
  MAX_PRODUCT_IMAGE_BYTES,
  removeProductImage,
  setVariantInventory,
  updateProductImageAlt,
  updateProductVariantPrice,
  uploadProductImage,
} from "../_core/shopifyAdmin";
import { runAdminAudited } from "../adminAudit";
import { getRecentAdminAuditLogs } from "../db";
import { adminProcedure, router } from "../_core/trpc";

const productId = z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/, "Choose a valid Shopify product.");
const variantId = z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/, "Choose a valid product variant.");
const mediaId = z.string().regex(/^gid:\/\/shopify\/MediaImage\/\d+$/, "Choose a valid product image.");
const locationId = z.string().regex(/^gid:\/\/shopify\/Location\/\d+$/, "Choose a valid inventory location.");
const priceAmount = z.string().trim().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/, "Use a non-negative price with up to 2 decimal places.");

const uploadInput = z.object({
  productId,
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_PRODUCT_IMAGE_MIME_TYPES),
  altText: z.string().trim().max(255).optional(),
  imageBase64: z.string().min(4).max(MAX_PRODUCT_IMAGE_BASE64_LENGTH),
});

export const adminMediaRouter = router({
  status: adminProcedure.query(() => ({
    adminApiConfigured: isShopifyAdminConfigured(),
    maxImageBytes: MAX_PRODUCT_IMAGE_BYTES,
  })),

  catalog: adminProcedure
    .input(z.object({ query: z.string().trim().max(100).optional(), cursor: z.string().max(2048).nullish() }))
    .query(({ input }) => listAdminProducts({ query: input.query, after: input.cursor })),

  productDetails: adminProcedure
    .input(z.object({ productId }))
    .query(({ input }) => getAdminProductDetails(input.productId)),

  locations: adminProcedure.query(() => listAdminLocations()),

  auditLogs: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(({ input }) => getRecentAdminAuditLogs(input.limit)),

  uploadProductImage: adminProcedure
    .input(uploadInput)
    .mutation(({ ctx, input }) => runAdminAudited(ctx.user, {
      action: "product.image.upload",
      targetType: "product",
      targetId: input.productId,
      metadata: { mimeType: input.mimeType },
    }, async () => {
      const result = await uploadProductImage(input);
      return {
        value: { productId: result.productId, productTitle: result.productTitle, status: result.status },
        after: { mimeType: input.mimeType, fileBytes: result.fileBytes, status: result.status },
      };
    })),

  updateImageAlt: adminProcedure
    .input(z.object({ productId, mediaId, alt: z.string().max(255) }))
    .mutation(({ ctx, input }) => runAdminAudited(ctx.user, {
      action: "product.image.alt.update",
      targetType: "product_image",
      targetId: input.mediaId,
      metadata: { productId: input.productId },
    }, async () => {
      const result = await updateProductImageAlt(input);
      return {
        value: { productId: result.productId, mediaId: result.mediaId, alt: result.alt },
        before: { alt: result.previousAlt },
        after: { alt: result.alt },
      };
    })),

  removeProductImage: adminProcedure
    .input(z.object({ productId, mediaId }))
    .mutation(({ ctx, input }) => runAdminAudited(ctx.user, {
      action: "product.image.detach",
      targetType: "product_image",
      targetId: input.mediaId,
      metadata: { productId: input.productId },
    }, async () => {
      const result = await removeProductImage(input);
      return {
        value: { productId: result.productId, mediaId: result.mediaId, filePreserved: result.filePreserved },
        before: { alt: result.previousAlt },
        after: { detachedFromProduct: true, filePreserved: result.filePreserved },
      };
    })),

  updateVariantPrice: adminProcedure
    .input(z.object({ productId, variantId, price: priceAmount }))
    .mutation(({ ctx, input }) => runAdminAudited(ctx.user, {
      action: "variant.price.update",
      targetType: "variant",
      targetId: input.variantId,
      metadata: { productId: input.productId },
    }, async () => {
      const result = await updateProductVariantPrice(input);
      return {
        value: { productId: result.productId, variantId: result.variantId, price: result.price },
        before: { price: result.previousPrice, currencyCode: result.currencyCode },
        after: { price: result.price, currencyCode: result.currencyCode },
      };
    })),

  setInventory: adminProcedure
    .input(z.object({
      productId,
      variantId,
      locationId,
      quantity: z.number().int().min(0).max(2_147_483_647),
      expectedCurrent: z.number().int().min(-2_147_483_648).max(2_147_483_647),
      idempotencyKey: z.string().uuid(),
    }))
    .mutation(({ ctx, input }) => runAdminAudited(ctx.user, {
      action: "inventory.available.set",
      targetType: "variant_location",
      targetId: `${input.variantId}:${input.locationId}`,
      metadata: { productId: input.productId, locationId: input.locationId },
    }, async () => {
      const result = await setVariantInventory(input);
      return {
        value: result,
        before: { available: result.previousQuantity },
        after: { available: result.quantity },
      };
    })),
});

export type AdminMediaRouter = typeof adminMediaRouter;
