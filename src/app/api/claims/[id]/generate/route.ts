import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { getAiProvider } from "@/lib/ai";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireStaffSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    throw err;
  }

  let aiProvider;
  try {
    aiProvider = getAiProvider();
  } catch (err) {
    const message = err instanceof Error ? err.message : "No AI provider configured.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { id: claimId } = await params;
  const claim = await db.claim.findFirst({
    where: { id: claimId, tenantId: session.user.tenantId },
    include: { evidenceItems: { orderBy: { createdAt: "asc" } } },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  // Images/PDFs go in as files; voicenotes go in as their (unverified) transcripts.
  const usable = claim.evidenceItems.filter(
    (e) => e.type === "IMAGE" || e.type === "PDF" || (e.type === "AUDIO" && e.transcript)
  );
  const untranscribed = claim.evidenceItems.filter((e) => e.type === "AUDIO" && !e.transcript);
  if (usable.length === 0) {
    return NextResponse.json(
      { error: "This claim has no analysable evidence yet. Upload photos/PDFs, or transcribe its voicenotes first." },
      { status: 400 }
    );
  }
  if (untranscribed.length > 0) {
    return NextResponse.json(
      {
        error: `${untranscribed.length} voicenote(s) have no transcript yet. Transcribe them (or remove them) before generating, so the case file reflects all evidence.`,
      },
      { status: 400 }
    );
  }

  const storage = getStorage();
  const evidence = await Promise.all(
    usable.map(async (item) => ({
      id: item.id,
      fileName: item.fileName,
      type: item.type === "AUDIO" ? "AUDIO (voicenote transcript, unverified)" : item.type,
      mimeType: item.mimeType,
      buffer: item.type === "AUDIO" ? undefined : await storage.get(item.storageKey),
      transcript: item.type === "AUDIO" ? item.transcript : undefined,
    }))
  );

  let result;
  try {
    result = await aiProvider.generateCaseFile({
      claim: {
        reference: claim.reference,
        claimantName: claim.claimantName,
        policyNumber: claim.policyNumber,
        incidentDate: claim.incidentDate?.toISOString().slice(0, 10) ?? null,
        incidentDescription: claim.incidentDescription,
      },
      evidence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error calling the AI provider.";
    return NextResponse.json({ error: `${aiProvider.name}: ${message}` }, { status: 502 });
  }

  const { content, modelName } = result;

  // Only ever cite evidence ids that actually exist on this claim.
  const validIds = new Set(usable.map((e) => e.id));
  const cleanIds = (ids: unknown): string[] =>
    Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && validIds.has(x)) : [];

  // Models occasionally leak commentary into statedValue instead of omitting it
  // (a genuine stated value like "USD 1,850" is short), and sometimes emit
  // duplicate items — sanitize and dedupe before persisting.
  if (Array.isArray(content.itemsClaimed)) {
    const seen = new Set<string>();
    content.itemsClaimed = content.itemsClaimed
      .filter((item) => item && typeof item.description === "string")
      .map((item) => ({
        description: item.description,
        statedValue:
          typeof item.statedValue === "string" &&
          item.statedValue.trim().length > 0 &&
          item.statedValue.trim().length <= 60
            ? item.statedValue.trim()
            : undefined,
        evidenceItemIds: cleanIds(item.evidenceItemIds),
      }))
      .filter((item) => {
        const key = `${item.description.trim().toLowerCase()}|${item.statedValue ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  const flags = Array.isArray(content.reviewFlags) ? content.reviewFlags : [];

  const caseFile = await db.$transaction(async (tx) => {
    const latest = await tx.caseFile.findFirst({
      where: { claimId: claim.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const created = await tx.caseFile.create({
      data: {
        tenantId: session.user.tenantId,
        claimId: claim.id,
        version: (latest?.version ?? 0) + 1,
        content: content as unknown as Prisma.InputJsonValue,
        model: modelName,
        generatedById: session.user.id,
      },
    });
    for (const flag of flags) {
      await tx.reviewFlag.create({
        data: {
          caseFileId: created.id,
          summary: typeof flag.summary === "string" ? flag.summary : "Review item",
          explanation: typeof flag.explanation === "string" ? flag.explanation : "",
          evidenceItemIds: cleanIds(flag.evidenceItemIds),
        },
      });
    }
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "case_file.generated",
        entityType: "CaseFile",
        entityId: created.id,
        after: {
          claimId: claim.id,
          version: created.version,
          model: modelName,
          evidenceCount: usable.length,
          flagCount: flags.length,
        },
      },
      tx
    );
    return created;
  });

  return NextResponse.json({ caseFile: { id: caseFile.id, version: caseFile.version } });
}
