import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { transcribeAudio, isTranscriptionAvailable } from "@/lib/ai/transcription";
import {
  ACCEPTED_EVIDENCE_TYPES as ACCEPTED,
  MAX_EVIDENCE_FILE_BYTES as MAX_FILE_BYTES,
} from "@/lib/evidenceTypes";
import type { EvidenceType } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const maxDuration = 300;

function evidenceTypeFor(mimeType: string): EvidenceType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "OTHER";
}

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
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });
  }

  const storage = getStorage();
  const created: { id: string; fileName: string; sha256: string }[] = [];

  for (const file of files) {
    if (!ACCEPTED.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type "${file.type}" for "${file.name}". JPG, PNG, PDF, and voicenotes (OGG/MP3/M4A/WAV) only.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `"${file.name}" is larger than the 25 MB per-file limit.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const storageKey = `tenants/${session.user.tenantId}/claims/${claimId}/${randomUUID()}-${safeName}`;

    await storage.put(storageKey, buffer, file.type);

    const evidenceType = evidenceTypeFor(file.type);
    let transcript: string | null = null;
    if (evidenceType === "AUDIO" && isTranscriptionAvailable()) {
      try {
        transcript = await transcribeAudio(buffer, file.type);
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
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
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
          after: { claimId, fileName: file.name, sha256, sizeBytes: file.size },
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
            after: { claimId, fileName: file.name, transcriptChars: transcript.length, verified: false },
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
