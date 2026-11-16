import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { resolveClaimRefByPortalToken } from "@/lib/portal";
import { ACCEPTED_EVIDENCE_TYPES } from "@/lib/evidenceTypes";
import type { EvidenceType } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const maxDuration = 120;

function evidenceTypeFor(mimeType: string): EvidenceType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "OTHER";
}

// Confirms a client portal upload: verifies the object, hashes it server-side,
// and records an EvidenceItem tagged source=PORTAL (attributed to the owning broker).
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await resolveClaimRefByPortalToken(token);
  if (!claim) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const storageKey = typeof body?.storageKey === "string" ? body.storageKey : "";
  const requiredPrefix = `tenants/${claim.tenantId}/claims/${claim.id}/portal/`;

  if (!fileName || !ACCEPTED_EVIDENCE_TYPES.includes(mimeType) || !storageKey.startsWith(requiredPrefix)) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (await db.evidenceItem.findFirst({ where: { storageKey } })) {
    return NextResponse.json({ error: "Already uploaded." }, { status: 409 });
  }

  let buffer: Buffer;
  try {
    buffer = await getStorage().get(storageKey);
  } catch {
    return NextResponse.json({ error: "Upload did not complete. Please try again." }, { status: 400 });
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  await db.$transaction(async (tx) => {
    const item = await tx.evidenceItem.create({
      data: {
        tenantId: claim.tenantId,
        claimId: claim.id,
        type: evidenceTypeFor(mimeType),
        fileName,
        mimeType,
        sizeBytes: buffer.length,
        storageKey,
        sha256,
        source: "PORTAL",
        uploadedById: claim.createdById,
      },
    });
    await writeAudit(
      {
        tenantId: claim.tenantId,
        actorId: null,
        actorEmail: `client:${claim.claimantName}`,
        action: "portal.evidence_uploaded",
        entityType: "EvidenceItem",
        entityId: item.id,
        after: { claimId: claim.id, fileName, sha256, source: "PORTAL" },
      },
      tx
    );
  });

  return NextResponse.json({ ok: true });
}
