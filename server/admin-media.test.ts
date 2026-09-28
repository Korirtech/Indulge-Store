import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function makeCtx(role: AuthenticatedUser["role"] = "admin"): TrpcContext {
  const now = new Date();
  const user: AuthenticatedUser = {
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
        productId: "gid://shopify/Product/12",
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
            product: { id: "gid://shopify/Product/12", title: "Daily Hydration Serum" },
            userErrors: [],
          },
        });
      }
      uploadUrl = url;
      uploadInit = init;
      return new Response(null, { status: 200 });
    });

    const result = await uploadProductImage({
      productId: "gid://shopify/Product/12",
      fileName: "daily serum.jpg",
      mimeType: "image/jpeg",
      altText: "Daily hydration serum",
      imageBase64: jpegBytes.toString("base64"),
    });

    expect(result).toEqual({
      productId: "gid://shopify/Product/12",
      productTitle: "Daily Hydration Serum",
      status: "processing",
    });
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
    expect(graphqlRequests[1]?.variables.product.id).toBe("gid://shopify/Product/12");
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

  it("does not allow a regular signed-in customer to use admin upload mutations", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(
      caller.adminMedia.uploadProductImage({
        productId: "gid://shopify/Product/12",
        fileName: "image.jpg",
        mimeType: "image/jpeg",
        imageBase64: jpegBytes.toString("base64"),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
