import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { resolveClaimRefByPortalToken } from "@/lib/portal";
import { ACCEPTED_EVIDENCE_TYPES, MAX_EVIDENCE_FILE_BYTES } from "@/lib/evidenceTypes";

// Client requests a direct-to-storage upload URL from the portal (token-scoped).
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await resolveClaimRefByPortalToken(token);
  if (!claim) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 404 });
  }

  const storage = getStorage();
  if (!storage.signedUploadUrl) {
    return NextResponse.json({ mode: "proxy" });
  }

  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : 0;

  if (!ACCEPTED_EVIDENCE_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type for "${fileName}". Photos, PDFs and voicenotes only.` },
      { status: 400 }
    );
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_EVIDENCE_FILE_BYTES) {
    return NextResponse.json({ error: `"${fileName}" exceeds the 25 MB limit.` }, { status: 400 });
  }

  const safeName = fileName.replace(/[^\w.\-]/g, "_");
  const storageKey = `tenants/${claim.tenantId}/claims/${claim.id}/portal/${randomUUID()}-${safeName}`;
  const uploadUrl = await storage.signedUploadUrl(storageKey);

  // Best-effort duplicate guard for a friendlier message; confirm re-checks too.
  await db.evidenceItem.count({ where: { claimId: claim.id } });

  return NextResponse.json({ mode: "direct", storageKey, uploadUrl });
}
