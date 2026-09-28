import { z } from "zod";
import { listProducts, isShopifyConfigured } from "../_core/shopify";
import {
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
  isShopifyAdminConfigured,
  MAX_PRODUCT_IMAGE_BASE64_LENGTH,
  MAX_PRODUCT_IMAGE_BYTES,
  uploadProductImage,
} from "../_core/shopifyAdmin";
import { adminProcedure, router } from "../_core/trpc";

const uploadInput = z.object({
  productId: z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/, "Choose a valid Shopify product."),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_PRODUCT_IMAGE_MIME_TYPES),
  altText: z.string().trim().max(255).optional(),
  imageBase64: z.string().min(4).max(MAX_PRODUCT_IMAGE_BASE64_LENGTH),
});

export const adminMediaRouter = router({
  status: adminProcedure.query(() => ({
    adminApiConfigured: isShopifyAdminConfigured(),
    storefrontConfigured: isShopifyConfigured(),
    maxImageBytes: MAX_PRODUCT_IMAGE_BYTES,
  })),

  products: adminProcedure.query(async () => {
    const products = await listProducts({ first: 100 });
    return products.map(product => ({
      id: product.id,
      handle: product.handle,
      title: product.title,
      imageUrl: product.images[0]?.url ?? null,
    }));
  }),

  uploadProductImage: adminProcedure
    .input(uploadInput)
    .mutation(async ({ input }) => uploadProductImage(input)),
});

export type AdminMediaRouter = typeof adminMediaRouter;
