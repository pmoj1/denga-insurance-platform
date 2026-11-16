import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// Create a policy (the thing that expires + drives the renewals queue).
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
  const policyNumber = typeof body?.policyNumber === "string" ? body.policyNumber.trim() : "";
  const clientName = typeof body?.clientName === "string" ? body.clientName.trim() : "";
  const insuranceType = typeof body?.insuranceType === "string" ? body.insuranceType.trim() : "";
  const expiryRaw = typeof body?.expiryDate === "string" ? body.expiryDate : "";
  const assetValue = typeof body?.assetValue === "string" && body.assetValue.trim() ? body.assetValue.trim() : null;
  const premium = typeof body?.premium === "string" && body.premium.trim() ? body.premium.trim() : null;

  if (!policyNumber || !clientName || !insuranceType || !expiryRaw) {
    return NextResponse.json(
      { error: "Policy number, client, type and expiry date are required." },
      { status: 400 }
    );
  }
  const expiryDate = new Date(expiryRaw);
  if (isNaN(expiryDate.getTime())) {
    return NextResponse.json({ error: "Invalid expiry date." }, { status: 400 });
  }

  const existing = await db.policy.findFirst({
    where: { tenantId: session.user.tenantId, policyNumber },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A policy with that number already exists." }, { status: 409 });
  }

  const policy = await db.$transaction(async (tx) => {
    const created = await tx.policy.create({
      data: {
        tenantId: session.user.tenantId,
        policyNumber,
        clientName,
        insuranceType,
        assetValue,
        premium,
        expiryDate,
        createdById: session.user.id,
      },
    });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "policy.created",
        entityType: "Policy",
        entityId: created.id,
        after: { policyNumber, clientName, expiryDate: expiryDate.toISOString() },
      },
      tx
    );
    return created;
  });

  return NextResponse.json({ policy: { id: policy.id } });
}
