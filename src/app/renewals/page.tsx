import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reminderTier, daysUntil, TIER_LABELS, type ReminderTier } from "@/services/renewalsEngine";
import { RenewalsBoard, type RenewalRow } from "@/components/RenewalsBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const TIER_ORDER: Record<ReminderTier, number> = { OVERDUE: 0, DUE: 1, D30: 2, D60: 3, D90: 4 };

export default async function RenewalsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Everything expiring within 90 days (and overdue), not already renewed/cancelled.
  const horizon = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000);
  const policies = await db.policy.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: "ACTIVE",
      expiryDate: { lte: horizon },
    },
    orderBy: { expiryDate: "asc" },
    include: {
      renewals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const now = new Date();
  const rows: RenewalRow[] = policies
    .flatMap((p) => {
      const tier = reminderTier(p.expiryDate, now);
      if (!tier) return [];
      const renewal = p.renewals[0] ?? null;
      const row: RenewalRow = {
        policyId: p.id,
        policyNumber: p.policyNumber,
        clientName: p.clientName,
        insuranceType: p.insuranceType,
        expiryDate: p.expiryDate.toISOString(),
        tier,
        tierLabel: TIER_LABELS[tier],
        daysUntil: daysUntil(p.expiryDate, now),
        renewalId: renewal?.id ?? null,
        renewalStatus: renewal?.status ?? null,
        quoteRange: renewal?.quoteRange ?? null,
        draftMessage: renewal?.draftMessage ?? null,
      };
      return [row];
    })
    .sort((a, b) => TIER_ORDER[a.tier as ReminderTier] - TIER_ORDER[b.tier as ReminderTier]);

  // Presentational tier summary for the strip under the header.
  const tierCounts = [
    { label: "Due / overdue", tone: "text-red-600", count: rows.filter((r) => r.tier === "OVERDUE" || r.tier === "DUE").length },
    { label: "Within 30 days", tone: "text-amber-600", count: rows.filter((r) => r.tier === "D30").length },
    { label: "Within 60 days", tone: "text-blue-600", count: rows.filter((r) => r.tier === "D60").length },
    { label: "Within 90 days", tone: "text-slate-600", count: rows.filter((r) => r.tier === "D90").length },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="Renewals"
        subtitle="Policies expiring within 90 days. Prepare a renewal, then approve before it goes to the client."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tierCounts.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className={`text-xl font-semibold tabular-nums ${t.tone}`}>{t.count}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t.label}</p>
          </div>
        ))}
      </div>
      <RenewalsBoard rows={rows} />
    </main>
  );
}
