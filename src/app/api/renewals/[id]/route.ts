import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { RenewalStatus } from "@/generated/prisma/enums";

// Renewal workflow transitions. Broker approval is required before sending:
// DRAFTED -> APPROVED -> SENT; or DECLINED. Sending returns the draft message
// to copy (no automated gateway yet).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireStaffSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;

  const renewal = await db.renewal.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { policy: true },
  });
  if (!renewal) {
    return NextResponse.json({ error: "Renewal not found." }, { status: 404 });
  }

  let status: RenewalStatus;
  const data: { status: RenewalStatus; approvedAt?: Date; sentAt?: Date; draftMessage?: string } = {
    status: renewal.status,
  };

  if (action === "approve") {
    if (renewal.status !== "DRAFTED") {
      return NextResponse.json({ error: "Only a drafted renewal can be approved." }, { status: 400 });
    }
    status = "APPROVED";
    data.status = status;
    data.approvedAt = new Date();
  } else if (action === "send") {
    if (renewal.status !== "APPROVED") {
      return NextResponse.json({ error: "Approve the renewal before sending." }, { status: 400 });
    }
    status = "SENT";
    data.status = status;
    data.sentAt = new Date();
  } else if (action === "decline") {
    status = "DECLINED";
    data.status = status;
  } else if (action === "save" && typeof body?.draftMessage === "string") {
    status = renewal.status;
    data.draftMessage = body.draftMessage.slice(0, 4000);
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.renewal.update({ where: { id: renewal.id }, data });
    // When sent, mark the policy renewed for the queue.
    if (action === "send") {
      await tx.policy.update({ where: { id: renewal.policyId }, data: { status: "RENEWED" } });
    }
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: `renewal.${action}`,
        entityType: "Renewal",
        entityId: renewal.id,
        after: { policyId: renewal.policyId, status: data.status },
      },
      tx
    );
    return result;
  });

  return NextResponse.json({ renewal: { id: updated.id, status: updated.status }, draftMessage: updated.draftMessage });
}
