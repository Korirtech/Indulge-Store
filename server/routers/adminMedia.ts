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

  uploadProductImage: adminProcedure
    .input(uploadInput)
    .mutation(({ input }) => uploadProductImage(input)),

  updateImageAlt: adminProcedure
    .input(z.object({ productId, mediaId, alt: z.string().max(255) }))
    .mutation(({ input }) => updateProductImageAlt(input)),

  removeProductImage: adminProcedure
    .input(z.object({ productId, mediaId }))
    .mutation(({ input }) => removeProductImage(input)),

  updateVariantPrice: adminProcedure
    .input(z.object({ productId, variantId, price: priceAmount }))
    .mutation(({ input }) => updateProductVariantPrice(input)),

  setInventory: adminProcedure
    .input(z.object({
      productId,
      variantId,
      locationId,
      quantity: z.number().int().min(0).max(2_147_483_647),
      expectedCurrent: z.number().int().min(-2_147_483_648).max(2_147_483_647),
      idempotencyKey: z.string().uuid(),
    }))
    .mutation(({ input }) => setVariantInventory(input)),
});

export type AdminMediaRouter = typeof adminMediaRouter;
