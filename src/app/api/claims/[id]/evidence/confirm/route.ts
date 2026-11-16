import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { transcribeAudio, isTranscriptionAvailable } from "@/lib/ai/transcription";
import { ACCEPTED_EVIDENCE_TYPES as ACCEPTED } from "@/lib/evidenceTypes";
import type { EvidenceType } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const maxDuration = 300;

function evidenceTypeFor(mimeType: string): EvidenceType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "OTHER";
}

/**
 * Step 2 of direct-to-storage upload: after the browser has PUT the file to
 * storage, verify it landed, hash it server-side (integrity = hash of what is
 * actually stored, not what the client claims), and record the EvidenceItem.
 */
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
  const files = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0 || files.length > 30) {
    return NextResponse.json({ error: "Provide between 1 and 30 files." }, { status: 400 });
  }

  // Keys must belong to this tenant + claim — never register arbitrary paths.
  const requiredPrefix = `tenants/${session.user.tenantId}/claims/${claimId}/`;
  const storage = getStorage();
  const created: { id: string; fileName: string; sha256: string }[] = [];

  for (const file of files) {
    const fileName = typeof file?.fileName === "string" ? file.fileName : "";
    const mimeType = typeof file?.mimeType === "string" ? file.mimeType : "";
    const storageKey = typeof file?.storageKey === "string" ? file.storageKey : "";

    if (!fileName || !ACCEPTED.includes(mimeType) || !storageKey.startsWith(requiredPrefix)) {
      return NextResponse.json({ error: `Invalid upload record for "${fileName}".` }, { status: 400 });
    }
    const existing = await db.evidenceItem.findFirst({ where: { storageKey } });
    if (existing) {
      return NextResponse.json({ error: `"${fileName}" is already registered.` }, { status: 409 });
    }

    let buffer: Buffer;
    try {
      buffer = await storage.get(storageKey);
    } catch {
      return NextResponse.json(
        { error: `"${fileName}" did not finish uploading. Please try again.` },
        { status: 400 }
      );
    }
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const evidenceType = evidenceTypeFor(mimeType);

    // Voicenotes are transcribed at ingestion (spec: STT first, transcript
    // stored on the EvidenceItem). Failure is non-fatal — the file is still
    // recorded and the UI offers a retry.
    let transcript: string | null = null;
    if (evidenceType === "AUDIO" && isTranscriptionAvailable()) {
      try {
        transcript = await transcribeAudio(buffer, mimeType);
      } catch {
        transcript = null;
      }
    }

    const item = await db.$transaction(async (tx) => {
      const evidence = await tx.evidenceItem.create({
        data: {
          tenantId: session.user.tenantId,
          claimId,
          type: evidenceType,
          fileName,
          mimeType,
          sizeBytes: buffer.length,
          storageKey,
          sha256,
          transcript,
          uploadedById: session.user.id,
        },
      });
      await writeAudit(
        {
          tenantId: session.user.tenantId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: "evidence.uploaded",
          entityType: "EvidenceItem",
          entityId: evidence.id,
          after: { claimId, fileName, sha256, sizeBytes: buffer.length },
        },
        tx
      );
      if (transcript !== null) {
        await writeAudit(
          {
            tenantId: session.user.tenantId,
            actorId: session.user.id,
            actorEmail: session.user.email,
            action: "evidence.transcribed",
            entityType: "EvidenceItem",
            entityId: evidence.id,
            after: { claimId, fileName, transcriptChars: transcript.length, verified: false },
          },
          tx
        );
      }
      return evidence;
    });

    created.push({ id: item.id, fileName: item.fileName, sha256: item.sha256 });
  }

  return NextResponse.json({ evidence: created });
}
