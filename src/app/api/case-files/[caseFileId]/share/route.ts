import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// Mints (or returns) the unguessable token gating a case file's share link.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ caseFileId: string }> }
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

  const { caseFileId } = await params;
  const caseFile = await db.caseFile.findFirst({
    where: { id: caseFileId, tenantId: session.user.tenantId },
  });
  if (!caseFile) {
    return NextResponse.json({ error: "Case file not found." }, { status: 404 });
  }

  if (caseFile.shareToken) {
    return NextResponse.json({ token: caseFile.shareToken });
  }

  const token = randomBytes(24).toString("base64url");
  await db.$transaction(async (tx) => {
    await tx.caseFile.update({ where: { id: caseFile.id }, data: { shareToken: token } });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "case_file.share_link_created",
        entityType: "CaseFile",
        entityId: caseFile.id,
      },
      tx
    );
  });

  return NextResponse.json({ token });
}
