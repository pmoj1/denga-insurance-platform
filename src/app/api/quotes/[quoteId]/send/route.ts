import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * "Send to client" — Denga has no WhatsApp/email gateway yet, so this marks the
 * quote as sent and returns the client-ready message for the broker to paste
 * into WhatsApp/email. It never silently claims to have delivered anything.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  let session;
  try {
    session = await requireStaffSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    throw err;
  }

  const { quoteId } = await params;
  const quote = await db.quote.findFirst({
    where: { id: quoteId, tenantId: session.user.tenantId },
  });
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.quote.update({
      where: { id: quote.id },
      data: { sentAt: quote.sentAt ?? new Date() },
    });
    if (!quote.sentAt) {
      await writeAudit(
        {
          tenantId: session.user.tenantId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "quote.marked_sent",
          entityType: "Quote",
          entityId: quote.id,
          after: { claimId: quote.claimId },
        },
        tx
      );
    }
    return result;
  });

  return NextResponse.json({ sentAt: updated.sentAt, clientMessage: updated.clientMessage });
}
