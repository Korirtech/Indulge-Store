import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { adminAuditLogs, InsertAdminAuditLog, InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type NewAdminAuditLog = Pick<
  InsertAdminAuditLog,
  "actorUserId" | "action" | "targetType" | "targetId" | "status" | "metadataJson"
>;

export type AdminAuditCompletion = Pick<InsertAdminAuditLog, "status"> &
  Partial<Pick<InsertAdminAuditLog, "beforeJson" | "afterJson" | "errorCode">>;

export async function createAdminAuditLog(entry: NewAdminAuditLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable; the audited admin action was not executed.");

  const inserted = await db.insert(adminAuditLogs).values(entry).$returningId();
  const id = inserted[0]?.id;
  if (typeof id !== "number") throw new Error("Database did not return the new audit record identifier.");
  return id;
}

export async function completeAdminAuditLog(id: number, completion: AdminAuditCompletion): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while finalizing the admin audit record.");

  await db.update(adminAuditLogs)
    .set({ ...completion, completedAt: new Date() })
    .where(eq(adminAuditLogs.id, id));
}

export async function getRecentAdminAuditLogs(limit: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while reading admin audit history.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Audit history limit must be between 1 and 100.");
  }

  return db.select({
    id: adminAuditLogs.id,
    actorUserId: adminAuditLogs.actorUserId,
    actorName: users.name,
    action: adminAuditLogs.action,
    targetType: adminAuditLogs.targetType,
    targetId: adminAuditLogs.targetId,
    status: adminAuditLogs.status,
    metadataJson: adminAuditLogs.metadataJson,
    beforeJson: adminAuditLogs.beforeJson,
    afterJson: adminAuditLogs.afterJson,
    errorCode: adminAuditLogs.errorCode,
    createdAt: adminAuditLogs.createdAt,
    completedAt: adminAuditLogs.completedAt,
  })
    .from(adminAuditLogs)
    .leftJoin(users, eq(adminAuditLogs.actorUserId, users.id))
    .orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id))
    .limit(limit);
}
