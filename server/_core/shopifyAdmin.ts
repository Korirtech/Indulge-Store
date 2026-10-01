import { TRPCError } from "@trpc/server";

export const SHOPIFY_ADMIN_API_VERSION = "2026-07";
export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PRODUCT_IMAGE_BASE64_LENGTH = Math.ceil(MAX_PRODUCT_IMAGE_BYTES / 3) * 4;
export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type ProductImageMimeType = (typeof ALLOWED_PRODUCT_IMAGE_MIME_TYPES)[number];

const PRODUCT_PAGE_SIZE = 50;
const PRODUCT_DETAIL_VARIANT_LIMIT = 250;
const PRODUCT_DETAIL_MEDIA_LIMIT = 100;
const SHOPIFY_GRAPHQL_TIMEOUT_MS = 20_000;

type GraphQLError = { message?: string };
type GraphQLResponse<T> = { data?: T; errors?: GraphQLError[] };
type ShopifyUserError = { field?: string[] | null; message: string; code?: string | null };
type StagedUploadTarget = {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
};

type UploadProductImageInput = {
  productId: string;
  fileName: string;
  mimeType: ProductImageMimeType;
  altText?: string;
  imageBase64: string;
};

type CatalogSearchInput = { query?: string; after?: string | null };
type UpdateVariantPriceInput = { productId: string; variantId: string; price: string };
type SetVariantInventoryInput = {
  productId: string;
  variantId: string;
  locationId: string;
  quantity: number;
  expectedCurrent: number;
  idempotencyKey: string;
};

const STAGED_UPLOADS_MUTATION = /* GraphQL */ `
  mutation StageProductImage($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }
`;

const PRODUCT_UPDATE_MEDIA_MUTATION = /* GraphQL */ `
  mutation UpdateProductWithNewMedia($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
    productUpdate(product: $product, media: $media) {
      product { id title }
      userErrors { field message }
    }
  }
`;

const ADMIN_CATALOG_QUERY = /* GraphQL */ `
  query AdminCatalog($first: Int!, $after: String, $query: String) {
    shop { currencyCode }
    products(first: $first, after: $after, query: $query, sortKey: TITLE) {
      nodes {
        id
        title
        handle
        status
        productType
        media(first: 1) {
          nodes {
            ... on MediaImage { image { url altText } }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const ADMIN_PRODUCT_DETAILS_QUERY = /* GraphQL */ `
  query AdminProductDetails($id: ID!) {
    shop { currencyCode }
    product(id: $id) {
      id
      title
      handle
      status
      productType
      media(first: 100) {
        nodes {
          id
          alt
          mediaContentType
          status
          ... on MediaImage { image { url width height } }
        }
        pageInfo { hasNextPage endCursor }
      }
      variants(first: 250) {
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          inventoryItem {
            id
            tracked
            inventoryLevels(first: 100, includeInactive: true) {
              nodes {
                isActive
                location { id name isActive }
                quantities(names: ["available"]) { name quantity }
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const ADMIN_LOCATIONS_QUERY = /* GraphQL */ `
  query AdminLocations {
    locations(first: 100) {
      nodes { id name isActive }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PRODUCT_IMAGE_LOOKUP_QUERY = /* GraphQL */ `
  query VerifyProductImage($id: ID!) {
    product(id: $id) {
      id
      title
      media(first: 100) {
        nodes { id alt mediaContentType status }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const VARIANT_PRICE_LOOKUP_QUERY = /* GraphQL */ `
  query VariantPriceBeforeUpdate($variantId: ID!) {
    shop { currencyCode }
    node(id: $variantId) {
      ... on ProductVariant {
        id
        price
        product { id }
      }
    }
  }
`;

const UPDATE_VARIANT_PRICE_MUTATION = /* GraphQL */ `
  mutation UpdateProductVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message code }
    }
  }
`;

const UPDATE_IMAGE_ALT_MUTATION = /* GraphQL */ `
  mutation UpdateProductImageAlt($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files { id alt }
      userErrors { field message code }
    }
  }
`;

const REMOVE_PRODUCT_IMAGE_REFERENCE_MUTATION = /* GraphQL */ `
  mutation RemoveProductImageReference($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files { id alt }
      userErrors { field message code }
    }
  }
`;

const VERIFY_VARIANT_INVENTORY_QUERY = /* GraphQL */ `
  query VerifyVariantInventory($variantId: ID!, $locationId: ID!) {
    node(id: $variantId) {
      ... on ProductVariant {
        id
        product { id }
        inventoryItem {
          id
          tracked
          inventoryLevel(locationId: $locationId, includeInactive: true) {
            isActive
            quantities(names: ["available"]) { name quantity }
          }
        }
      }
    }
  }
`;

const SET_AVAILABLE_INVENTORY_MUTATION = /* GraphQL */ `
  mutation SetAvailableInventory(
    $input: InventorySetQuantitiesInput!
    $idempotencyKey: String!
  ) {
    inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
      inventoryAdjustmentGroup { createdAt reason }
      userErrors { code field message }
    }
  }
`;

function normalizeStoreDomain(): string | null {
  const rawDomain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").trim();
  const domain = rawDomain.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/.test(domain) ? domain : null;
}

export function isShopifyAdminConfigured(): boolean {
  return Boolean(normalizeStoreDomain() && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim());
}

function requireAdminConfig(): { endpoint: string; token: string } {
  const domain = normalizeStoreDomain();
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() ?? "";
  if (!domain || !token) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Shopify Admin is not configured. Add SHOPIFY_ADMIN_ACCESS_TOKEN and verify SHOPIFY_STORE_DOMAIN in the server environment.",
    });
  }
  return {
    endpoint: `https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
    token,
  };
}

async function adminGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const { endpoint, token } = requireAdminConfig();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(SHOPIFY_GRAPHQL_TIMEOUT_MS),
    });
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Shopify Admin API is unreachable. Try again in a moment.",
    });
  }

  if (!response.ok) {
    throw new TRPCError({
      code: response.status === 401 || response.status === 403 ? "FORBIDDEN" : "BAD_GATEWAY",
      message:
        response.status === 401 || response.status === 403
          ? "Shopify rejected the Admin API credential. Verify the token and the required app/staff permissions."
          : `Shopify Admin API returned HTTP ${response.status}.`,
    });
  }

  let payload: GraphQLResponse<T>;
  try {
    payload = (await response.json()) as GraphQLResponse<T>;
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify Admin API returned an unreadable response." });
  }

  if (payload.errors?.length) {
    const firstMessage = payload.errors[0]?.message ?? "";
    const scopeError = /access denied|not authorized|permission/i.test(firstMessage);
    throw new TRPCError({
      code: scopeError ? "FORBIDDEN" : "BAD_GATEWAY",
      message: scopeError
        ? "Shopify denied this operation. Verify the installed app scopes and the signed-in staff user's Shopify permissions."
        : "Shopify Admin API could not complete the operation.",
    });
  }
  if (!payload.data) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify Admin API returned no data." });
  }
  return payload.data;
}

function throwUserErrors(errors: ShopifyUserError[] | null | undefined, operation: string): void {
  if (!errors?.length) return;
  const first = errors[0]!;
  if (first.code === "CHANGE_FROM_QUANTITY_STALE") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Stock changed in Shopify since this page loaded. Refresh the product and review the new quantity before saving.",
    });
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: first.message || `Shopify could not complete the ${operation}.`,
  });
}

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

function assertProductGid(value: string): void {
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(value)) badRequest("Choose a valid Shopify product.");
}

function assertVariantGid(value: string): void {
  if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(value)) badRequest("Choose a valid Shopify variant.");
}

function assertLocationGid(value: string): void {
  if (!/^gid:\/\/shopify\/Location\/\d+$/.test(value)) badRequest("Choose a valid Shopify location.");
}

function assertMediaImageGid(value: string): void {
  if (!/^gid:\/\/shopify\/MediaImage\/\d+$/.test(value)) badRequest("Choose a valid Shopify product image.");
}

function normalizePrice(value: string): string {
  const price = value.trim();
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(price)) {
    badRequest("Enter a non-negative price with up to 2 decimal places.");
  }
  return price;
}

export type AdminCatalogInput = CatalogSearchInput;

export async function listAdminProducts(input: AdminCatalogInput): Promise<{
  products: Array<{
    id: string;
    title: string;
    handle: string;
    status: string;
    productType: string;
    imageUrl: string | null;
    imageAlt: string | null;
  }>;
  currencyCode: string;
  hasNextPage: boolean;
  nextCursor: string | null;
}> {
  const data = await adminGraphql<{
    shop: { currencyCode: string };
    products: {
      nodes: Array<{
        id: string;
        title: string;
        handle: string;
        status: string;
        productType: string;
        media: { nodes: Array<{ image?: { url?: string | null; altText?: string | null } | null }> };
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(ADMIN_CATALOG_QUERY, {
    first: PRODUCT_PAGE_SIZE,
    after: input.after ?? null,
    query: input.query?.trim() || null,
  });

  return {
    products: data.products.nodes.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      productType: product.productType,
      imageUrl: product.media.nodes[0]?.image?.url ?? null,
      imageAlt: product.media.nodes[0]?.image?.altText ?? null,
    })),
    currencyCode: data.shop.currencyCode,
    hasNextPage: data.products.pageInfo.hasNextPage,
    nextCursor: data.products.pageInfo.endCursor,
  };
}

export async function listAdminLocations(): Promise<Array<{ id: string; name: string }>> {
  const data = await adminGraphql<{
    locations: { nodes: Array<{ id: string; name: string; isActive: boolean }> };
  }>(ADMIN_LOCATIONS_QUERY, {});
  return data.locations.nodes.filter(location => location.isActive).map(({ id, name }) => ({ id, name }));
}

export async function getAdminProductDetails(productId: string): Promise<{
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  currencyCode: string;
  images: Array<{ id: string; alt: string; status: string; url: string | null; width: number | null; height: number | null }>;
  hasMoreImages: boolean;
  variants: Array<{
    id: string;
    title: string;
    sku: string;
    price: string;
    compareAtPrice: string | null;
    tracked: boolean;
    inventoryLevels: Array<{
      locationId: string;
      locationName: string;
      locationActive: boolean;
      active: boolean;
      available: number | null;
    }>;
  }>;
  hasMoreVariants: boolean;
}> {
  assertProductGid(productId);
  const data = await adminGraphql<{
    shop: { currencyCode: string };
    product: null | {
      id: string;
      title: string;
      handle: string;
      status: string;
      productType: string;
      media: {
        nodes: Array<{
          id: string;
          alt: string | null;
          mediaContentType: string;
          status: string;
          image?: { url: string | null; width: number | null; height: number | null } | null;
        }>;
        pageInfo: { hasNextPage: boolean };
      };
      variants: {
        nodes: Array<{
          id: string;
          title: string;
          sku: string | null;
          price: string;
          compareAtPrice: string | null;
          inventoryItem: null | {
            tracked: boolean;
            inventoryLevels: { nodes: Array<{
              isActive: boolean;
              location: { id: string; name: string; isActive: boolean };
              quantities: Array<{ name: string; quantity: number }>;
            }> };
          };
        }>;
        pageInfo: { hasNextPage: boolean };
      };
    };
  }>(ADMIN_PRODUCT_DETAILS_QUERY, { id: productId });

  const product = data.product;
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Shopify did not find that product." });

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    productType: product.productType,
    currencyCode: data.shop.currencyCode,
    images: product.media.nodes
      .filter(media => media.mediaContentType === "IMAGE")
      .map(media => ({
        id: media.id,
        alt: media.alt ?? "",
        status: media.status,
        url: media.image?.url ?? null,
        width: media.image?.width ?? null,
        height: media.image?.height ?? null,
      })),
    hasMoreImages: product.media.pageInfo.hasNextPage,
    variants: product.variants.nodes.map(variant => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku ?? "",
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      tracked: variant.inventoryItem?.tracked ?? false,
      inventoryLevels: (variant.inventoryItem?.inventoryLevels.nodes ?? []).map(level => ({
        locationId: level.location.id,
        locationName: level.location.name,
        locationActive: level.location.isActive,
        active: level.isActive,
        available: level.quantities.find(quantity => quantity.name === "available")?.quantity ?? null,
      })),
    })),
    hasMoreVariants: product.variants.pageInfo.hasNextPage,
  };
}

export function decodeAndValidateProductImage(imageBase64: string, mimeType: ProductImageMimeType): Buffer {
  if (imageBase64.length > MAX_PRODUCT_IMAGE_BASE64_LENGTH) {
    return badRequest(`Choose an image no larger than ${MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024} MB.`);
  }
  if (
    imageBase64.length === 0 ||
    imageBase64.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(imageBase64)
  ) {
    return badRequest("The selected image data is invalid. Choose the image again and retry.");
  }

  const bytes = Buffer.from(imageBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PRODUCT_IMAGE_BYTES) {
    return badRequest(`Choose an image no larger than ${MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024} MB.`);
  }
  if (bytes.toString("base64") !== imageBase64) {
    return badRequest("The selected image data is invalid. Choose the image again and retry.");
  }

  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";

  const matchesMime =
    (mimeType === "image/jpeg" && isJpeg) ||
    (mimeType === "image/png" && isPng) ||
    (mimeType === "image/webp" && isWebp);
  if (!matchesMime) {
    return badRequest("The image content does not match its file type. Use a JPG, PNG, or WebP image.");
  }
  return bytes;
}

function safeShopifyFileName(fileName: string, mimeType: ProductImageMimeType): string {
  const extensionByMime: Record<ProductImageMimeType, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const leafName = fileName.split(/[\\/]/).pop() ?? "product-image";
  const withoutExtension = leafName.replace(/\.[^.]*$/, "");
  const safeStem = withoutExtension
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${safeStem || "product-image"}.${extensionByMime[mimeType]}`;
}

function assertHttpsUrl(value: string, fieldName: string): void {
  try {
    if (new URL(value).protocol !== "https:") throw new Error("not https");
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Shopify returned an invalid ${fieldName}.` });
  }
}

export async function uploadProductImage(input: UploadProductImageInput): Promise<{
  productId: string;
  productTitle: string;
  status: "processing";
  fileBytes: number;
}> {
  assertProductGid(input.productId);
  const bytes = decodeAndValidateProductImage(input.imageBase64, input.mimeType);
  const fileName = safeShopifyFileName(input.fileName, input.mimeType);
  const altText = input.altText?.trim().slice(0, 255) || fileName.replace(/\.[^.]+$/, "").replace(/-/g, " ");

  const stagedData = await adminGraphql<{
    stagedUploadsCreate: { stagedTargets: StagedUploadTarget[]; userErrors: ShopifyUserError[] };
  }>(STAGED_UPLOADS_MUTATION, {
    input: [{ filename: fileName, fileSize: String(bytes.length), mimeType: input.mimeType, httpMethod: "PUT", resource: "PRODUCT_IMAGE" }],
  });
  const staged = stagedData.stagedUploadsCreate;
  throwUserErrors(staged.userErrors, "image staging");
  const target = staged.stagedTargets?.[0];
  if (!target?.url || !target.resourceUrl || !Array.isArray(target.parameters)) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify did not return an image upload target." });
  }
  assertHttpsUrl(target.url, "upload target");
  assertHttpsUrl(target.resourceUrl, "resource URL");

  const targetHeaders = new Headers();
  for (const parameter of target.parameters) targetHeaders.set(parameter.name, parameter.value);
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(target.url, {
      method: "PUT",
      headers: targetHeaders,
      body: Uint8Array.from(bytes),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Shopify could not receive the image. Try again in a moment." });
  }
  if (!uploadResponse.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify could not receive the image." });

  const productData = await adminGraphql<{
    productUpdate: { product: { id: string; title: string } | null; userErrors: ShopifyUserError[] };
  }>(PRODUCT_UPDATE_MEDIA_MUTATION, {
    product: { id: input.productId },
    media: [{ originalSource: target.resourceUrl, alt: altText, mediaContentType: "IMAGE" }],
  });
  const update = productData.productUpdate;
  throwUserErrors(update.userErrors, "product image upload");
  if (!update.product) throw new TRPCError({ code: "NOT_FOUND", message: "Shopify did not find that product." });
  return { productId: update.product.id, productTitle: update.product.title, status: "processing", fileBytes: bytes.length };
}

async function getReadyProductImage(productId: string, mediaId: string): Promise<{ id: string; title: string; alt: string }> {
  assertProductGid(productId);
  assertMediaImageGid(mediaId);
  const data = await adminGraphql<{
    product: null | {
      id: string;
      title: string;
      media: { nodes: Array<{ id: string; alt: string | null; mediaContentType: string; status: string }> };
    };
  }>(PRODUCT_IMAGE_LOOKUP_QUERY, { id: productId });
  if (!data.product) throw new TRPCError({ code: "NOT_FOUND", message: "Shopify did not find that product." });
  const image = data.product.media.nodes.find(media => media.id === mediaId && media.mediaContentType === "IMAGE");
  if (!image) throw new TRPCError({ code: "NOT_FOUND", message: "That image is not in the selected product's gallery." });
  if (image.status !== "READY") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Shopify is still processing this image. Try again when it is ready." });
  }
  return { id: data.product.id, title: data.product.title, alt: image.alt ?? "" };
}

export async function updateProductImageAlt(input: {
  productId: string;
  mediaId: string;
  alt: string;
}): Promise<{ productId: string; mediaId: string; previousAlt: string; alt: string }> {
  const previous = await getReadyProductImage(input.productId, input.mediaId);
  const data = await adminGraphql<{
    fileUpdate: { files: Array<{ id: string; alt: string | null }> | null; userErrors: ShopifyUserError[] };
  }>(UPDATE_IMAGE_ALT_MUTATION, { files: [{ id: input.mediaId, alt: input.alt }] });
  throwUserErrors(data.fileUpdate.userErrors, "image alt-text update");
  const updated = data.fileUpdate.files?.find(file => file.id === input.mediaId);
  if (!updated) throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify did not confirm the image update." });
  return { productId: input.productId, mediaId: updated.id, previousAlt: previous.alt, alt: updated.alt ?? "" };
}

export async function removeProductImage(input: {
  productId: string;
  mediaId: string;
}): Promise<{ productId: string; mediaId: string; previousAlt: string; filePreserved: true }> {
  const previous = await getReadyProductImage(input.productId, input.mediaId);
  const data = await adminGraphql<{
    fileUpdate: { files: Array<{ id: string; alt: string | null }> | null; userErrors: ShopifyUserError[] };
  }>(REMOVE_PRODUCT_IMAGE_REFERENCE_MUTATION, {
    files: [{ id: input.mediaId, referencesToRemove: [input.productId] }],
  });
  throwUserErrors(data.fileUpdate.userErrors, "image removal from product");
  return { productId: input.productId, mediaId: input.mediaId, previousAlt: previous.alt, filePreserved: true };
}

export async function updateProductVariantPrice(input: UpdateVariantPriceInput): Promise<{
  productId: string;
  variantId: string;
  previousPrice: string;
  price: string;
  currencyCode: string;
}> {
  assertProductGid(input.productId);
  assertVariantGid(input.variantId);
  const price = normalizePrice(input.price);
  const snapshot = await adminGraphql<{
    shop: { currencyCode: string };
    node: null | { id: string; price: string; product: { id: string } };
  }>(VARIANT_PRICE_LOOKUP_QUERY, { variantId: input.variantId });
  const current = snapshot.node;
  if (!current || current.product.id !== input.productId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That variant does not belong to the selected product." });
  }

  const data = await adminGraphql<{
    productVariantsBulkUpdate: {
      productVariants: Array<{ id: string; price: string }> | null;
      userErrors: ShopifyUserError[];
    };
  }>(UPDATE_VARIANT_PRICE_MUTATION, {
    productId: input.productId,
    variants: [{ id: input.variantId, price }],
  });
  throwUserErrors(data.productVariantsBulkUpdate.userErrors, "variant price update");
  const variant = data.productVariantsBulkUpdate.productVariants?.find(item => item.id === input.variantId);
  if (!variant) throw new TRPCError({ code: "NOT_FOUND", message: "Shopify did not update that product variant." });
  return {
    productId: input.productId,
    variantId: variant.id,
    previousPrice: current.price,
    price: variant.price,
    currencyCode: snapshot.shop.currencyCode,
  };
}

export async function setVariantInventory(input: SetVariantInventoryInput): Promise<{
  productId: string;
  variantId: string;
  locationId: string;
  previousQuantity: number;
  quantity: number;
}> {
  assertProductGid(input.productId);
  assertVariantGid(input.variantId);
  assertLocationGid(input.locationId);
  if (!Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > 2_147_483_647) {
    badRequest("Enter a whole stock quantity between 0 and 2,147,483,647.");
  }
  if (!Number.isInteger(input.expectedCurrent) || input.expectedCurrent < -2_147_483_648 || input.expectedCurrent > 2_147_483_647) {
    badRequest("Refresh the product and try again with the current stock value.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
    badRequest("The stock update request identifier is invalid. Refresh the page and retry.");
  }

  const verified = await adminGraphql<{
    node: null | {
      id: string;
      product: { id: string };
      inventoryItem: null | {
        id: string;
        tracked: boolean;
        inventoryLevel: null | {
          isActive: boolean;
          quantities: Array<{ name: string; quantity: number }>;
        };
      };
    };
  }>(VERIFY_VARIANT_INVENTORY_QUERY, { variantId: input.variantId, locationId: input.locationId });
  const variant = verified.node;
  if (!variant || variant.product.id !== input.productId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That variant does not belong to the selected product." });
  }
  const item = variant.inventoryItem;
  if (!item?.tracked) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Inventory tracking is off for this variant. Enable it in Shopify first." });
  }
  const level = item.inventoryLevel;
  if (!level?.isActive) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This variant is not stocked at the selected active location." });
  }
  const currentQuantity = level.quantities.find(quantity => quantity.name === "available")?.quantity;
  if (typeof currentQuantity !== "number") {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify did not return the available stock quantity." });
  }
  if (currentQuantity !== input.expectedCurrent) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Stock changed in Shopify since this page loaded. Refresh the product and review the new quantity before saving.",
    });
  }

  const data = await adminGraphql<{
    inventorySetQuantities: { userErrors: ShopifyUserError[] };
  }>(SET_AVAILABLE_INVENTORY_MUTATION, {
    idempotencyKey: input.idempotencyKey,
    input: {
      name: "available",
      reason: "correction",
      referenceDocumentUri: `indulge-essentials://admin-dashboard/stock/${input.idempotencyKey}`,
      quantities: [{
        inventoryItemId: item.id,
        locationId: input.locationId,
        quantity: input.quantity,
        changeFromQuantity: input.expectedCurrent,
      }],
    },
  });
  throwUserErrors(data.inventorySetQuantities.userErrors, "inventory update");
  return {
    productId: input.productId,
    variantId: input.variantId,
    locationId: input.locationId,
    previousQuantity: input.expectedCurrent,
    quantity: input.quantity,
  };
}
