import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditDbMocks = vi.hoisted(() => ({
  createAdminAuditLog: vi.fn(),
  completeAdminAuditLog: vi.fn(),
  getRecentAdminAuditLogs: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createAdminAuditLog: auditDbMocks.createAdminAuditLog,
    completeAdminAuditLog: auditDbMocks.completeAdminAuditLog,
    getRecentAdminAuditLogs: auditDbMocks.getRecentAdminAuditLogs,
  };
});

import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  decodeAndValidateProductImage,
  MAX_PRODUCT_IMAGE_BASE64_LENGTH,
  uploadProductImage,
} from "./_core/shopifyAdmin";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
const fetchMock = vi.fn<typeof fetch>();
const originalEnv = {
  domain: process.env.SHOPIFY_STORE_DOMAIN,
  token: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
};
const productId = "gid://shopify/Product/12";
const variantId = "gid://shopify/ProductVariant/34";
const mediaId = "gid://shopify/MediaImage/56";
const locationId = "gid://shopify/Location/78";
const idempotencyKey = "123e4567-e89b-42d3-a456-426614174000";

function makeCtx(role: AuthenticatedUser["role"] | null = "admin"): TrpcContext {
  const now = new Date();
  const user: AuthenticatedUser | null = role === null ? null : {
    id: 7,
    openId: "owner-7",
    email: "owner@example.com",
    name: "Store Owner",
    loginMethod: "manus",
    role,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  auditDbMocks.createAdminAuditLog.mockReset().mockResolvedValue(123);
  auditDbMocks.completeAdminAuditLog.mockReset().mockResolvedValue(undefined);
  auditDbMocks.getRecentAdminAuditLogs.mockReset().mockResolvedValue([]);
  process.env.SHOPIFY_STORE_DOMAIN = "test.myshopify.com";
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "test-admin-token";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalEnv.domain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
  else process.env.SHOPIFY_STORE_DOMAIN = originalEnv.domain;
  if (originalEnv.token === undefined) delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  else process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = originalEnv.token;
});

describe("Shopify product-image upload", () => {
  it("accepts only image bytes matching the declared MIME type", () => {
    expect(decodeAndValidateProductImage(jpegBytes.toString("base64"), "image/jpeg")).toEqual(jpegBytes);
    expect(() => decodeAndValidateProductImage(jpegBytes.toString("base64"), "image/png")).toThrow(/does not match/i);
    expect(() => decodeAndValidateProductImage("bm90LWltYWdl", "image/jpeg")).toThrow(/does not match/i);
  });

  it("rejects malformed base64 before making a network request", async () => {
    await expect(
      uploadProductImage({
        productId,
        fileName: "image.jpg",
        mimeType: "image/jpeg",
        imageBase64: "not base64!",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an image payload larger than the 8 MiB limit", () => {
    const tooLarge = "A".repeat(MAX_PRODUCT_IMAGE_BASE64_LENGTH + 4);
    expect(() => decodeAndValidateProductImage(tooLarge, "image/jpeg")).toThrow(/8 MB/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stages an image, uploads bytes to the temporary target, and attaches it with productUpdate", async () => {
    const graphqlRequests: Array<{ query: string; variables: Record<string, any> }> = [];
    let uploadUrl = "";
    let uploadInit: RequestInit | undefined;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/admin/api/2026-07/graphql.json")) {
        const request = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, any> };
        graphqlRequests.push(request);
        if (request.query.includes("StageProductImage")) {
          return jsonResponse({
            stagedUploadsCreate: {
              stagedTargets: [{
                url: "https://staged.example/upload",
                resourceUrl: "https://staged.example/image.jpg?temporary=token",
                parameters: [{ name: "content_type", value: "image/jpeg" }, { name: "acl", value: "private" }],
              }],
              userErrors: [],
            },
          });
        }
        return jsonResponse({
          productUpdate: {
            product: { id: productId, title: "Daily Hydration Serum" },
            userErrors: [],
          },
        });
      }
      uploadUrl = url;
      uploadInit = init;
      return new Response(null, { status: 200 });
    });

    const result = await uploadProductImage({
      productId,
      fileName: "daily serum.jpg",
      mimeType: "image/jpeg",
      altText: "Daily hydration serum",
      imageBase64: jpegBytes.toString("base64"),
    });

    expect(result).toEqual({ productId, productTitle: "Daily Hydration Serum", status: "processing", fileBytes: jpegBytes.length });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(graphqlRequests).toHaveLength(2);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-Shopify-Access-Token")).toBe("test-admin-token");
    expect(graphqlRequests[0]?.variables.input[0]).toMatchObject({
      filename: "daily-serum.jpg",
      mimeType: "image/jpeg",
      httpMethod: "PUT",
      resource: "PRODUCT_IMAGE",
    });
    expect(graphqlRequests[1]?.query).toMatch(/productUpdate\(product:\s*\$product,\s*media:\s*\$media\)/);
    expect(graphqlRequests[1]?.variables.product.id).toBe(productId);
    expect(graphqlRequests[1]?.variables.media[0]).toMatchObject({
      originalSource: "https://staged.example/image.jpg?temporary=token",
      alt: "Daily hydration serum",
      mediaContentType: "IMAGE",
    });
    expect(uploadUrl).toBe("https://staged.example/upload");
    expect(uploadInit?.method).toBe("PUT");
    expect(Buffer.from(uploadInit?.body as Uint8Array)).toEqual(jpegBytes);
    expect(new Headers(uploadInit?.headers).get("content_type")).toBe("image/jpeg");
  });
});

describe("Shopify admin catalog dashboard", () => {
  it("returns searchable catalog rows with currency and pagination", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      shop: { currencyCode: "KES" },
      products: {
        nodes: [{
          id: productId,
          title: "Daily Hydration Serum",
          handle: "daily-hydration-serum",
          status: "ACTIVE",
          productType: "Skincare",
          media: { nodes: [{ image: { url: "https://cdn.example/serum.jpg", altText: "Serum" } }] },
        }],
        pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
      },
    }));

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.adminMedia.catalog({ query: "serum", cursor: null });
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));

    expect(result).toMatchObject({
      currencyCode: "KES",
      hasNextPage: true,
      nextCursor: "cursor-1",
      products: [{ id: productId, title: "Daily Hydration Serum", imageUrl: "https://cdn.example/serum.jpg" }],
    });
    expect(request.variables).toMatchObject({ first: 50, query: "serum", after: null });
  });

  it("returns active inventory locations only", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      locations: { nodes: [
        { id: locationId, name: "Nairobi", isActive: true },
        { id: "gid://shopify/Location/99", name: "Closed", isActive: false },
      ] },
    }));
    const result = await appRouter.createCaller(makeCtx()).adminMedia.locations();
    expect(result).toEqual([{ id: locationId, name: "Nairobi" }]);
  });

  it("updates one variant price with productVariantsBulkUpdate", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        shop: { currencyCode: "KES" },
        node: { id: variantId, price: "20.00", product: { id: productId } },
      }))
      .mockResolvedValueOnce(jsonResponse({
        productVariantsBulkUpdate: { productVariants: [{ id: variantId, price: "23.50" }], userErrors: [] },
      }));
    const result = await appRouter.createCaller(makeCtx()).adminMedia.updateVariantPrice({
      productId,
      variantId,
      price: "23.50",
    });
    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(result).toEqual({ productId, variantId, price: "23.50" });
    expect(request.query).toContain("productVariantsBulkUpdate");
    expect(request.variables).toEqual({ productId, variants: [{ id: variantId, price: "23.50" }] });
    expect(auditDbMocks.createAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 7,
      action: "variant.price.update",
      targetType: "variant",
      targetId: variantId,
      status: "started",
    }));
    expect(auditDbMocks.completeAdminAuditLog).toHaveBeenCalledWith(123, {
      status: "succeeded",
      beforeJson: JSON.stringify({ price: "20.00", currencyCode: "KES" }),
      afterJson: JSON.stringify({ price: "23.50", currencyCode: "KES" }),
    });
  });

  it("rejects an invalid variant price before calling Shopify", async () => {
    await expect(appRouter.createCaller(makeCtx()).adminMedia.updateVariantPrice({
      productId,
      variantId,
      price: "-10.00",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates alt text only for a ready image in the selected product", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        product: { id: productId, title: "Serum", media: { nodes: [{ id: mediaId, alt: "Old serum text", mediaContentType: "IMAGE", status: "READY" }] } },
      }))
      .mockResolvedValueOnce(jsonResponse({ fileUpdate: { files: [{ id: mediaId, alt: "Serum bottle" }], userErrors: [] } }));

    const result = await appRouter.createCaller(makeCtx()).adminMedia.updateImageAlt({
      productId,
      mediaId,
      alt: "Serum bottle",
    });
    const updateRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(result).toEqual({ productId, mediaId, alt: "Serum bottle" });
    expect(updateRequest.variables.files).toEqual([{ id: mediaId, alt: "Serum bottle" }]);
    expect(auditDbMocks.completeAdminAuditLog).toHaveBeenCalledWith(123, {
      status: "succeeded",
      beforeJson: JSON.stringify({ alt: "Old serum text" }),
      afterJson: JSON.stringify({ alt: "Serum bottle" }),
    });
  });

  it("detaches an image from the product without deleting the Shopify file", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        product: { id: productId, title: "Serum", media: { nodes: [{ id: mediaId, alt: "Serum image", mediaContentType: "IMAGE", status: "READY" }] } },
      }))
      .mockResolvedValueOnce(jsonResponse({ fileUpdate: { files: [{ id: mediaId, alt: "Serum" }], userErrors: [] } }));

    const result = await appRouter.createCaller(makeCtx()).adminMedia.removeProductImage({ productId, mediaId });
    const updateRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(result).toEqual({ productId, mediaId, filePreserved: true });
    expect(updateRequest.query).toContain("fileUpdate");
    expect(updateRequest.variables.files).toEqual([{ id: mediaId, referencesToRemove: [productId] }]);
    expect(auditDbMocks.completeAdminAuditLog).toHaveBeenCalledWith(123, {
      status: "succeeded",
      beforeJson: JSON.stringify({ alt: "Serum image" }),
      afterJson: JSON.stringify({ detachedFromProduct: true, filePreserved: true }),
    });
  });

  it("sets available inventory with a current-value check and an idempotency directive", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        node: {
          id: variantId,
          product: { id: productId },
          inventoryItem: { id: "gid://shopify/InventoryItem/90", tracked: true, inventoryLevel: { isActive: true, quantities: [{ name: "available", quantity: 4 }] } },
        },
      }))
      .mockResolvedValueOnce(jsonResponse({ inventorySetQuantities: { userErrors: [] } }));

    const result = await appRouter.createCaller(makeCtx()).adminMedia.setInventory({
      productId,
      variantId,
      locationId,
      quantity: 7,
      expectedCurrent: 4,
      idempotencyKey,
    });
    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(result).toEqual({ productId, variantId, locationId, previousQuantity: 4, quantity: 7 });
    expect(request.query).toContain("@idempotent(key: $idempotencyKey)");
    expect(request.variables.idempotencyKey).toBe(idempotencyKey);
    expect(request.variables.input.quantities[0]).toMatchObject({
      inventoryItemId: "gid://shopify/InventoryItem/90",
      locationId,
      quantity: 7,
      changeFromQuantity: 4,
    });
    expect(auditDbMocks.completeAdminAuditLog).toHaveBeenCalledWith(123, {
      status: "succeeded",
      beforeJson: JSON.stringify({ available: 4 }),
      afterJson: JSON.stringify({ available: 7 }),
    });
  });

  it("rejects a stale stock value and never sends an inventory write", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      node: {
        id: variantId,
        product: { id: productId },
        inventoryItem: { id: "gid://shopify/InventoryItem/90", tracked: true, inventoryLevel: { isActive: true, quantities: [{ name: "available", quantity: 5 }] } },
      },
    }));

    await expect(appRouter.createCaller(makeCtx()).adminMedia.setInventory({
      productId,
      variantId,
      locationId,
      quantity: 7,
      expectedCurrent: 4,
      idempotencyKey,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("records a successful image upload with safe file metadata and no credential values", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/admin/api/2026-07/graphql.json")) {
        const request = JSON.parse(String(init?.body)) as { query: string };
        if (request.query.includes("StageProductImage")) {
          return jsonResponse({ stagedUploadsCreate: {
            stagedTargets: [{ url: "https://staged.example/upload", resourceUrl: "https://staged.example/image.jpg", parameters: [] }],
            userErrors: [],
          } });
        }
        return jsonResponse({ productUpdate: { product: { id: productId, title: "Serum" }, userErrors: [] } });
      }
      return new Response(null, { status: 200 });
    });

    const result = await appRouter.createCaller(makeCtx()).adminMedia.uploadProductImage({
      productId,
      fileName: "serum.jpg",
      mimeType: "image/jpeg",
      imageBase64: jpegBytes.toString("base64"),
    });

    expect(result).toEqual({ productId, productTitle: "Serum", status: "processing" });
    expect(auditDbMocks.createAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 7,
      action: "product.image.upload",
      targetType: "product",
      targetId: productId,
      metadataJson: JSON.stringify({ mimeType: "image/jpeg" }),
    }));
    expect(auditDbMocks.completeAdminAuditLog).toHaveBeenCalledWith(123, {
      status: "succeeded",
      beforeJson: null,
      afterJson: JSON.stringify({ mimeType: "image/jpeg", fileBytes: jpegBytes.length, status: "processing" }),
    });
    expect(JSON.stringify(auditDbMocks.completeAdminAuditLog.mock.calls)).not.toContain("test-admin-token");
  });

  it("records failed Shopify actions using only a safe error code", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        shop: { currencyCode: "KES" },
        node: { id: variantId, price: "20.00", product: { id: productId } },
      }))
      .mockResolvedValueOnce(jsonResponse({
        productVariantsBulkUpdate: {
          productVariants: [],
          userErrors: [{ code: "ACCESS_DENIED", message: "Sensitive Shopify detail must not enter the audit record." }],
        },
      }));

    await expect(appRouter.createCaller(makeCtx()).adminMedia.updateVariantPrice({
      productId,
      variantId,
      price: "23.50",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(auditDbMocks.completeAdminAuditLog).toHaveBeenCalledWith(123, {
      status: "failed",
      errorCode: "BAD_REQUEST",
    });
    expect(JSON.stringify(auditDbMocks.completeAdminAuditLog.mock.calls)).not.toContain("Sensitive Shopify detail");
  });

  it("fails closed and does not call Shopify if the audit intent cannot be stored", async () => {
    auditDbMocks.createAdminAuditLog.mockRejectedValueOnce(new Error("audit database unavailable"));

    await expect(appRouter.createCaller(makeCtx()).adminMedia.updateVariantPrice({
      productId,
      variantId,
      price: "23.50",
    })).rejects.toThrow(/audit database unavailable/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(auditDbMocks.completeAdminAuditLog).not.toHaveBeenCalled();
  });

  it("returns only the capped, selected audit fields to an administrator", async () => {
    const auditRow = {
      id: 8,
      actorUserId: 7,
      actorName: "Store Owner",
      action: "variant.price.update",
      targetType: "variant",
      targetId: variantId,
      status: "succeeded",
      metadataJson: null,
      beforeJson: '{"price":"20.00"}',
      afterJson: '{"price":"23.50"}',
      errorCode: null,
      createdAt: new Date("2026-10-01T10:00:00Z"),
      completedAt: new Date("2026-10-01T10:00:01Z"),
    };
    auditDbMocks.getRecentAdminAuditLogs.mockResolvedValueOnce([auditRow]);

    const result = await appRouter.createCaller(makeCtx()).adminMedia.auditLogs({ limit: 50 });

    expect(result).toEqual([auditRow]);
    expect(auditDbMocks.getRecentAdminAuditLogs).toHaveBeenCalledWith(50);
    expect(JSON.stringify(result)).not.toContain("openId");
  });

  it("rejects anonymous requests to every dashboard endpoint before Shopify calls", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const calls = [
      caller.adminMedia.status(),
      caller.adminMedia.catalog({ query: "serum", cursor: null }),
      caller.adminMedia.productDetails({ productId }),
      caller.adminMedia.locations(),
      caller.adminMedia.auditLogs({ limit: 50 }),
      caller.adminMedia.uploadProductImage({
        productId,
        fileName: "image.jpg",
        mimeType: "image/jpeg",
        imageBase64: jpegBytes.toString("base64"),
      }),
      caller.adminMedia.updateImageAlt({ productId, mediaId, alt: "Serum" }),
      caller.adminMedia.removeProductImage({ productId, mediaId }),
      caller.adminMedia.updateVariantPrice({ productId, variantId, price: "23.50" }),
      caller.adminMedia.setInventory({
        productId,
        variantId,
        locationId,
        quantity: 7,
        expectedCurrent: 4,
        idempotencyKey,
      }),
    ];

    await Promise.all(calls.map(call => expect(call).rejects.toMatchObject({ code: "UNAUTHORIZED" })));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects regular customers from every dashboard endpoint before Shopify calls", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    const calls = [
      caller.adminMedia.status(),
      caller.adminMedia.catalog({ query: "serum", cursor: null }),
      caller.adminMedia.productDetails({ productId }),
      caller.adminMedia.locations(),
      caller.adminMedia.auditLogs({ limit: 50 }),
      caller.adminMedia.uploadProductImage({
        productId,
        fileName: "image.jpg",
        mimeType: "image/jpeg",
        imageBase64: jpegBytes.toString("base64"),
      }),
      caller.adminMedia.updateImageAlt({ productId, mediaId, alt: "Serum" }),
      caller.adminMedia.removeProductImage({ productId, mediaId }),
      caller.adminMedia.updateVariantPrice({ productId, variantId, price: "23.50" }),
      caller.adminMedia.setInventory({
        productId,
        variantId,
        locationId,
        quantity: 7,
        expectedCurrent: 4,
        idempotencyKey,
      }),
    ];
    await Promise.all(calls.map(call => expect(call).rejects.toMatchObject({ code: "FORBIDDEN" })));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not allow a regular signed-in customer to use admin upload mutations", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.adminMedia.uploadProductImage({
      productId,
      fileName: "image.jpg",
      mimeType: "image/jpeg",
      imageBase64: jpegBytes.toString("base64"),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
