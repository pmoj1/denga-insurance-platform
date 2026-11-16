import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ClaimStatus } from "@/generated/prisma/enums";

const VALID_STATUSES = Object.values(ClaimStatus);

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

  const { id: claimId } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status as ClaimStatus | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const claim = await db.claim.findFirst({
    where: { id: claimId, tenantId: session.user.tenantId },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }
  if (claim.status === status) {
    return NextResponse.json({ claim: { id: claim.id, status: claim.status } });
  }

  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.claim.update({
      where: { id: claim.id },
      data: { status },
    });
    // Stage-history timeline entry for this transition.
    await tx.claimStageEvent.create({
      data: {
        claimId: claim.id,
        fromStatus: claim.status,
        toStatus: status,
        note,
        actorEmail: session.user.email,
      },
    });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "claim.status_changed",
        entityType: "Claim",
        entityId: claim.id,
        before: { status: claim.status },
        after: { status, note },
      },
      tx
    );
    return result;
  });

  return NextResponse.json({ claim: { id: updated.id, status: updated.status } });
}
