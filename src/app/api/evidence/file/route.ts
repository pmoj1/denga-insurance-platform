import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

// Serves evidence bytes for the local-disk storage adapter (dev fallback).
// Auth-gated and tenant-scoped: the key must belong to an EvidenceItem in the caller's tenant.
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    throw err;
  }

  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key." }, { status: 400 });
  }

  const item = await db.evidenceItem.findFirst({
    where: { storageKey: key, tenantId: session.user.tenantId },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const data = await getStorage().get(key);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": item.mimeType,
      "Content-Disposition": `inline; filename="${item.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
