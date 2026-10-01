import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import { completeAdminAuditLog, createAdminAuditLog } from "./db";

export type AdminAuditAction =
  | "product.image.upload"
  | "product.image.alt.update"
  | "product.image.detach"
  | "variant.price.update"
  | "inventory.available.set";

export type AdminAuditEvent = {
  action: AdminAuditAction;
  targetType: "product" | "product_image" | "variant" | "variant_location";
  targetId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AuditedOperationResult<T> = {
  value: T;
  before?: Record<string, string | number | boolean | null> | null;
  after?: Record<string, string | number | boolean | null> | null;
};

function serializeAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const serialized = JSON.stringify(value);
  if (serialized.length > 8_192) {
    throw new Error("Audit snapshot exceeded the supported size.");
  }
  return serialized;
}

function safeErrorCode(error: unknown): string {
  return error instanceof TRPCError ? error.code : "UNEXPECTED_ERROR";
}

export async function runAdminAudited<T>(
  actor: Pick<User, "id">,
  event: AdminAuditEvent,
  operation: () => Promise<AuditedOperationResult<T>>
): Promise<T> {
  // A durable intent record is required before any Shopify mutation is allowed to run.
  const auditId = await createAdminAuditLog({
    actorUserId: actor.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    status: "started",
    metadataJson: serializeAuditValue(event.metadata),
  });

  let outcome: AuditedOperationResult<T>;
  try {
    outcome = await operation();
  } catch (error) {
    try {
      await completeAdminAuditLog(auditId, {
        status: "failed",
        errorCode: safeErrorCode(error),
      });
    } catch (auditError) {
      console.error("[Audit] Could not finalize failed admin action", { auditId, auditError });
    }
    throw error;
  }

  try {
    await completeAdminAuditLog(auditId, {
      status: "succeeded",
      beforeJson: serializeAuditValue(outcome.before),
      afterJson: serializeAuditValue(outcome.after),
    });
  } catch (auditError) {
    console.error("[Audit] Could not finalize successful admin action", { auditId, auditError });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The Shopify change may have succeeded, but its audit record could not be finalized. Verify the catalog before retrying.",
    });
  }

  return outcome.value;
}
