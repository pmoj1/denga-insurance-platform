import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { resolveClaimRefByPortalToken } from "@/lib/portal";

// Client accepts or rejects the latest quote from the portal. Token-scoped.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await resolveClaimRefByPortalToken(token);
  if (!claim) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const quoteId = typeof body?.quoteId === "string" ? body.quoteId : "";
  const decision = body?.decision === "ACCEPTED" ? "ACCEPTED" : body?.decision === "REJECTED" ? "REJECTED" : null;
  if (!quoteId || !decision) {
    return NextResponse.json({ error: "Choose accept or reject." }, { status: 400 });
  }

  const quote = await db.quote.findFirst({ where: { id: quoteId, claimId: claim.id } });
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: { clientResponse: decision, clientRespondedAt: new Date() },
    });
    await writeAudit(
      {
        tenantId: claim.tenantId,
        actorId: null,
        actorEmail: `client:${claim.claimantName}`,
        action: "portal.quote_response",
        entityType: "Quote",
        entityId: quote.id,
        after: { claimId: claim.id, decision },
      },
      tx
    );
  });

  return NextResponse.json({ ok: true, decision });
}
