import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ClientRequestType } from "@/generated/prisma/enums";

// Broker raises a request the client will see + action in the portal:
// a QUESTION to answer, or a DOCUMENT to upload.
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
  const claim = await db.claim.findFirst({
    where: { id: claimId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const type = body?.type === "DOCUMENT" ? ClientRequestType.DOCUMENT : ClientRequestType.QUESTION;
  if (!prompt) {
    return NextResponse.json({ error: "Enter what you need from the client." }, { status: 400 });
  }

  const created = await db.$transaction(async (tx) => {
    const req = await tx.clientRequest.create({
      data: {
        tenantId: session.user.tenantId,
        claimId: claim.id,
        type,
        prompt: prompt.slice(0, 500),
        createdById: session.user.id,
      },
    });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "claim.client_request_created",
        entityType: "ClientRequest",
        entityId: req.id,
        after: { claimId: claim.id, type, prompt: req.prompt },
      },
      tx
    );
    return req;
  });

  return NextResponse.json({ request: { id: created.id } });
}
