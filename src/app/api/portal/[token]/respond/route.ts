import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { resolveClaimRefByPortalToken } from "@/lib/portal";

// Client answers a broker QUESTION from the portal. Token-scoped; no login.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await resolveClaimRefByPortalToken(token);
  if (!claim) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const response = typeof body?.response === "string" ? body.response.trim() : "";
  if (!requestId || !response) {
    return NextResponse.json({ error: "Type your answer first." }, { status: 400 });
  }

  // The request must belong to this token's claim.
  const clientRequest = await db.clientRequest.findFirst({
    where: { id: requestId, claimId: claim.id },
  });
  if (!clientRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.clientRequest.update({
      where: { id: clientRequest.id },
      data: { response: response.slice(0, 2000), respondedAt: new Date() },
    });
    await writeAudit(
      {
        tenantId: claim.tenantId,
        actorId: null,
        actorEmail: `client:${claim.claimantName}`,
        action: "portal.request_answered",
        entityType: "ClientRequest",
        entityId: clientRequest.id,
        after: { claimId: claim.id },
      },
      tx
    );
  });

  return NextResponse.json({ ok: true });
}
