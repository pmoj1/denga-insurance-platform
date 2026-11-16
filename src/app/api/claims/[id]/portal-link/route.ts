import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// Mints (or returns) the unguessable token that gates this claim's client portal.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const claim = await db.claim.findFirst({
    where: { id: claimId, tenantId: session.user.tenantId },
    select: { id: true, clientAccessToken: true },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  if (claim.clientAccessToken) {
    return NextResponse.json({ token: claim.clientAccessToken });
  }

  const token = randomBytes(24).toString("base64url");
  await db.$transaction(async (tx) => {
    await tx.claim.update({ where: { id: claim.id }, data: { clientAccessToken: token } });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "claim.portal_link_created",
        entityType: "Claim",
        entityId: claim.id,
      },
      tx
    );
  });

  return NextResponse.json({ token });
}
