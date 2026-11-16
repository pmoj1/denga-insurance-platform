import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { transcribeAudio } from "@/lib/ai/transcription";

export const runtime = "nodejs";
export const maxDuration = 300;

// Retry transcription for an audio EvidenceItem (e.g. after a transient failure).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> }
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

  const { evidenceId } = await params;
  const item = await db.evidenceItem.findFirst({
    where: { id: evidenceId, tenantId: session.user.tenantId },
  });
  if (!item) {
    return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  }
  if (item.type !== "AUDIO") {
    return NextResponse.json({ error: "Only audio evidence can be transcribed." }, { status: 400 });
  }

  let transcript: string;
  try {
    const buffer = await getStorage().get(item.storageKey);
    transcript = await transcribeAudio(buffer, item.mimeType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await db.$transaction(async (tx) => {
    await tx.evidenceItem.update({ where: { id: item.id }, data: { transcript } });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "evidence.transcribed",
        entityType: "EvidenceItem",
        entityId: item.id,
        after: { claimId: item.claimId, fileName: item.fileName, transcriptChars: transcript.length, verified: false },
      },
      tx
    );
  });

  return NextResponse.json({ transcript });
}
