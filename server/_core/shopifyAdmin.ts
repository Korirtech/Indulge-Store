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

type GraphQLError = { message?: string };
type GraphQLResponse<T> = { data?: T; errors?: GraphQLError[] };
type ShopifyUserError = { field?: string[] | null; message: string };
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

const STAGED_UPLOADS_MUTATION = /* GraphQL */ `
  mutation StageProductImage($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
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

function normalizeStoreDomain(): string | null {
  const rawDomain = (process.env.SHOPIFY_STORE_DOMAIN ?? "").trim();
  const domain = rawDomain.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/.test(domain)
    ? domain
    : null;
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
        "Shopify Admin uploads are not configured. Add SHOPIFY_ADMIN_ACCESS_TOKEN and verify SHOPIFY_STORE_DOMAIN in the server environment.",
    });
  }
  return {
    endpoint: `https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
    token,
  };
}

async function adminGraphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
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
      signal: AbortSignal.timeout(20_000),
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
          ? "Shopify rejected the Admin API credential. Verify the token and its write_files/write_products scopes."
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
        ? "Shopify denied the operation. Verify the installed app has write_files and write_products scopes."
        : "Shopify Admin API could not complete the media operation.",
    });
  }
  if (!payload.data) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify Admin API returned no data." });
  }
  return payload.data;
}

function badImage(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export function decodeAndValidateProductImage(
  imageBase64: string,
  mimeType: ProductImageMimeType
): Buffer {
  if (imageBase64.length > MAX_PRODUCT_IMAGE_BASE64_LENGTH) {
    return badImage(`Choose an image smaller than ${MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024} MB.`);
  }
  if (
    imageBase64.length === 0 ||
    imageBase64.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(imageBase64)
  ) {
    return badImage("The selected image data is invalid. Choose the image again and retry.");
  }

  const bytes = Buffer.from(imageBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PRODUCT_IMAGE_BYTES) {
    return badImage(`Choose an image smaller than ${MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024} MB.`);
  }
  if (bytes.toString("base64") !== imageBase64) {
    return badImage("The selected image data is invalid. Choose the image again and retry.");
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
    return badImage("The image content does not match its file type. Use a JPG, PNG, or WebP image.");
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
}> {
  const bytes = decodeAndValidateProductImage(input.imageBase64, input.mimeType);
  const fileName = safeShopifyFileName(input.fileName, input.mimeType);
  const altText = input.altText?.trim().slice(0, 255) || fileName.replace(/\.[^.]+$/, "").replace(/-/g, " ");

  const stagedData = await adminGraphql<{
    stagedUploadsCreate: { stagedTargets: StagedUploadTarget[]; userErrors: ShopifyUserError[] };
  }>(STAGED_UPLOADS_MUTATION, {
    input: [
      {
        filename: fileName,
        fileSize: String(bytes.length),
        mimeType: input.mimeType,
        httpMethod: "PUT",
        resource: "PRODUCT_IMAGE",
      },
    ],
  });
  const staged = stagedData.stagedUploadsCreate;
  if (staged.userErrors?.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: staged.userErrors[0].message });
  }
  const target = staged.stagedTargets?.[0];
  if (!target?.url || !target.resourceUrl || !Array.isArray(target.parameters)) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify did not return an image upload target." });
  }
  assertHttpsUrl(target.url, "upload target");
  assertHttpsUrl(target.resourceUrl, "resource URL");

  const targetHeaders = new Headers();
  for (const parameter of target.parameters) {
    targetHeaders.set(parameter.name, parameter.value);
  }
  const uploadBytes = Uint8Array.from(bytes);
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(target.url, {
      method: "PUT",
      headers: targetHeaders,
      body: uploadBytes,
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Shopify could not receive the image. Try again in a moment.",
    });
  }
  if (!uploadResponse.ok) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Shopify could not receive the image." });
  }

  const productData = await adminGraphql<{
    productUpdate: { product: { id: string; title: string } | null; userErrors: ShopifyUserError[] };
  }>(PRODUCT_UPDATE_MEDIA_MUTATION, {
    product: { id: input.productId },
    media: [
      {
        originalSource: target.resourceUrl,
        alt: altText,
        mediaContentType: "IMAGE",
      },
    ],
  });
  const update = productData.productUpdate;
  if (update.userErrors?.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: update.userErrors[0].message });
  }
  if (!update.product) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Shopify did not find that product." });
  }

  return {
    productId: update.product.id,
    productTitle: update.product.title,
    status: "processing",
  };
}
