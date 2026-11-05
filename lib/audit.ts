import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export async function writeAuditLog(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string;
}) {
  const db = getDb();
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ?? null,
  });
}
