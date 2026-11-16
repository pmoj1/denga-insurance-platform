import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

interface AuditParams {
  tenantId: string;
  actorId: string | null;
  actorEmail: string;
  action: string; // e.g. "claim.created", "claim.status_changed"
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Append-only audit trail. Every state change goes through here.
 * Never expose update/delete for AuditLogEntry anywhere in the app.
 */
export async function writeAudit(params: AuditParams, tx?: Prisma.TransactionClient) {
  const client = tx ?? db;
  await client.auditLogEntry.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before === undefined ? undefined : (params.before as Prisma.InputJsonValue),
      after: params.after === undefined ? undefined : (params.after as Prisma.InputJsonValue),
    },
  });
}
