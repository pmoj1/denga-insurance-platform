import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { CaseFileDocument, type EvidenceDisplayItem } from "@/components/CaseFileDocument";
import { CaseFileToolbar } from "@/components/CaseFileToolbar";
import type { CaseFileContent } from "@/lib/types";

export default async function CaseFilePage({
  params,
}: {
  params: Promise<{ id: string; caseFileId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: claimId, caseFileId } = await params;
  const caseFile = await db.caseFile.findFirst({
    where: { id: caseFileId, claimId, tenantId: session.user.tenantId },
    include: {
      claim: { include: { evidenceItems: true } },
    },
  });
  if (!caseFile) notFound();

  const storage = getStorage();
  const evidence: EvidenceDisplayItem[] = await Promise.all(
    caseFile.claim.evidenceItems.map(async (item) => ({
      id: item.id,
      fileName: item.fileName,
      type: item.type,
      sha256: item.sha256,
      imageUrl:
        item.type === "IMAGE" ? await storage.signedUrl(item.storageKey).catch(() => null) : null,
      transcript: item.transcript,
    }))
  );

  return (
    <main className="px-6 py-8">
      <div className="no-print mx-auto mb-6 flex w-full max-w-3xl items-center justify-between">
        <Link href={`/claims/${claimId}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← {caseFile.claim.reference}
        </Link>
        <CaseFileToolbar caseFileId={caseFile.id} />
      </div>

      <CaseFileDocument
        content={caseFile.content as unknown as CaseFileContent}
        evidence={evidence}
        version={caseFile.version}
        generatedAt={caseFile.createdAt}
        modelName={caseFile.model}
      />
    </main>
  );
}
