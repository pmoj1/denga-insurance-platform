import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { ClaimsTable, type ClaimListRow } from "@/components/ClaimsTable";

export default async function ClaimsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const claims = await db.claim.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { evidenceItems: true, caseFiles: true } },
    },
  });

  const rows: ClaimListRow[] = claims.map((claim) => ({
    id: claim.id,
    reference: claim.reference,
    claimantName: claim.claimantName,
    policyNumber: claim.policyNumber,
    incidentDate: claim.incidentDate ? claim.incidentDate.toISOString() : null,
    evidenceCount: claim._count.evidenceItems,
    hasCaseFile: claim._count.caseFiles > 0,
    status: claim.status,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Claims"
        subtitle="Every claim in your brokerage, searchable and sortable."
        actions={<ButtonLink href="/claims/new">New claim</ButtonLink>}
      />
      <ClaimsTable rows={rows} />
    </main>
  );
}
