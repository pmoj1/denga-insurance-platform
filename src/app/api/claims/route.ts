import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";

function newClaimReference(): string {
  const year = new Date().getFullYear();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `CLM-${year}-${suffix}`;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const claimantName = typeof body?.claimantName === "string" ? body.claimantName.trim() : "";
  if (!claimantName) {
    return NextResponse.json({ error: "Claimant name is required." }, { status: 400 });
  }

  const policyNumber =
    typeof body?.policyNumber === "string" && body.policyNumber.trim() ? body.policyNumber.trim() : null;
  const incidentDescription =
    typeof body?.incidentDescription === "string" && body.incidentDescription.trim()
      ? body.incidentDescription.trim()
      : null;

  let incidentDate: Date | null = null;
  if (typeof body?.incidentDate === "string" && body.incidentDate) {
    const parsed = new Date(body.incidentDate);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid incident date." }, { status: 400 });
    }
    incidentDate = parsed;
  }

  // Optional smart-intake payload: the client's raw message + the AI extraction.
  const intakeRaw =
    typeof body?.intakeRaw === "string" && body.intakeRaw.trim()
      ? body.intakeRaw.trim().slice(0, 20_000)
      : null;
  const intake =
    body?.intake && typeof body.intake === "object" && !Array.isArray(body.intake)
      ? (body.intake as Prisma.InputJsonValue)
      : undefined;

  const claim = await db.$transaction(async (tx) => {
    const created = await tx.claim.create({
      data: {
        tenantId: session.user.tenantId,
        reference: newClaimReference(),
        claimantName,
        policyNumber,
        incidentDate,
        incidentDescription,
        intakeRaw,
        intake,
        createdById: session.user.id,
      },
    });
    // Seed the stage-history timeline with the opening state.
    await tx.claimStageEvent.create({
      data: {
        claimId: created.id,
        fromStatus: null,
        toStatus: created.status,
        note: intake !== undefined ? "Created from smart intake" : "Claim created",
        actorEmail: session.user.email,
      },
    });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "claim.created",
        entityType: "Claim",
        entityId: created.id,
        after: {
          reference: created.reference,
          claimantName,
          policyNumber,
          status: created.status,
          smartIntake: intake !== undefined,
        },
      },
      tx
    );
    return created;
  });

  return NextResponse.json({ claim: { id: claim.id, reference: claim.reference } });
}
