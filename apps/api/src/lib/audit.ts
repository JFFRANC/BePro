import { auditEvents } from "@bepro/db";
import type { Database } from "@bepro/db";

export interface RecordAuditEventParams {
  tenantId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export async function recordAuditEvent(
  db: Database,
  params: RecordAuditEventParams,
): Promise<void> {
  await db.insert(auditEvents).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    oldValues: params.oldValues ?? null,
    newValues: params.newValues ?? null,
  });
}
