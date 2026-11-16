import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import {
  ACCEPTED_EVIDENCE_TYPES as ACCEPTED,
  MAX_EVIDENCE_FILE_BYTES as MAX_FILE_BYTES,
} from "@/lib/evidenceTypes";

/**
 * Step 1 of direct-to-storage upload: mint signed upload URLs so the browser
 * sends file bytes straight to object storage (bypasses host body-size limits).
 * Falls back to `mode: "proxy"` when the storage adapter can't mint URLs
 * (local-disk dev) — the client then uses the multipart route instead.
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

  const storage = getStorage();
  if (!storage.signedUploadUrl) {
    return NextResponse.json({ mode: "proxy" });
  }

  const body = await request.json().catch(() => null);
  const files = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0 || files.length > 30) {
    return NextResponse.json({ error: "Provide between 1 and 30 files." }, { status: 400 });
  }

  const uploads = [];
  for (const file of files) {
    const fileName = typeof file?.fileName === "string" ? file.fileName : "";
    const mimeType = typeof file?.mimeType === "string" ? file.mimeType : "";
    const sizeBytes = typeof file?.sizeBytes === "number" ? file.sizeBytes : 0;

    if (!ACCEPTED.includes(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type "${mimeType}" for "${fileName}". JPG, PNG, PDF, and voicenotes (OGG/MP3/M4A/WAV) only.` },
        { status: 400 }
      );
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `"${fileName}" exceeds the 25 MB per-file limit.` },
        { status: 400 }
      );
    }

    const safeName = fileName.replace(/[^\w.\-]/g, "_");
    const storageKey = `tenants/${session.user.tenantId}/claims/${claimId}/${randomUUID()}-${safeName}`;
    uploads.push({
      fileName,
      storageKey,
      uploadUrl: await storage.signedUploadUrl(storageKey),
    });
  }

  return NextResponse.json({ mode: "direct", uploads });
}
