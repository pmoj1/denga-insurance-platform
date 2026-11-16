import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { generateQuote, buildClientMessage } from "@/services/quoteEngine";
import { refineClientMessage } from "@/agents/quoteAgent";
import type { IntakeData } from "@/services/nextActionEngine";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

// Default follow-up window for a fresh quote: 36h (midpoint of the 24–48h spec).
const FOLLOW_UP_HOURS = 36;

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

  const { id: claimId } = await params;
  const claim = await db.claim.findFirst({
    where: { id: claimId, tenantId: session.user.tenantId },
  });
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  const intake = (claim.intake as IntakeData | null) ?? null;
  if (!intake || !intake.insurance_type) {
    return NextResponse.json(
      { error: "This claim has no Smart Intake data to quote from. Run smart intake first." },
      { status: 400 }
    );
  }

  const quote = generateQuote(intake);
  const clientMessage = await refineClientMessage(
    buildClientMessage(quote, claim.claimantName),
    quote
  );

  const followUpDueAt = new Date(Date.now() + FOLLOW_UP_HOURS * 60 * 60 * 1000);

  const saved = await db.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        tenantId: session.user.tenantId,
        claimId: claim.id,
        insuranceType: quote.insurance_type,
        assetValue: quote.asset_value,
        clientSummary: quote.client_summary,
        riskFlags: quote.risk_flags as unknown as Prisma.InputJsonValue,
        recommendedOptions: quote.recommended_options as unknown as Prisma.InputJsonValue,
        estimatedPremiumRange: quote.estimated_premium_range,
        assumptions: quote.assumptions as unknown as Prisma.InputJsonValue,
        recommendation: quote.recommendation,
        clientMessage,
        followUpRequired: true,
        followUpDueAt,
        createdById: session.user.id,
      },
    });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "quote.generated",
        entityType: "Quote",
        entityId: created.id,
        after: {
          claimId: claim.id,
          insuranceType: quote.insurance_type,
          range: quote.estimated_premium_range,
          options: quote.recommended_options.length,
        },
      },
      tx
    );
    return created;
  });

  return NextResponse.json({ quote: { id: saved.id } });
}
