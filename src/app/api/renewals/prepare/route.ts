import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession, UnauthorizedError } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { reminderTier, buildRenewalDraft, renewalQuoteRange } from "@/services/renewalsEngine";

// Broker prepares a renewal for a policy: generates the draft reminder + an
// indicative renewal quote range. Status DRAFTED — requires approval to send.
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
  const policyId = typeof body?.policyId === "string" ? body.policyId : "";
  const policy = await db.policy.findFirst({
    where: { id: policyId, tenantId: session.user.tenantId },
  });
  if (!policy) {
    return NextResponse.json({ error: "Policy not found." }, { status: 404 });
  }

  const tier = reminderTier(policy.expiryDate) ?? "D90";
  const draftMessage = buildRenewalDraft(policy);
  const quoteRange = renewalQuoteRange(policy);

  // One active renewal per policy: reuse the latest non-terminal one if present.
  const existing = await db.renewal.findFirst({
    where: { policyId: policy.id, status: { in: ["DRAFTED", "APPROVED"] } },
    orderBy: { createdAt: "desc" },
  });

  const renewal = await db.$transaction(async (tx) => {
    const saved = existing
      ? await tx.renewal.update({
          where: { id: existing.id },
          data: { reminderTier: tier, draftMessage, quoteRange, status: "DRAFTED" },
        })
      : await tx.renewal.create({
          data: {
            tenantId: session.user.tenantId,
            policyId: policy.id,
            dueDate: policy.expiryDate,
            reminderTier: tier,
            draftMessage,
            quoteRange,
            status: "DRAFTED",
            createdById: session.user.id,
          },
        });
    await writeAudit(
      {
        tenantId: session.user.tenantId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "renewal.prepared",
        entityType: "Renewal",
        entityId: saved.id,
        after: { policyId: policy.id, tier, quoteRange },
      },
      tx
    );
    return saved;
  });

  return NextResponse.json({ renewal: { id: renewal.id } });
}
