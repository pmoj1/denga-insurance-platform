import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { CaseFileDocument, type EvidenceDisplayItem } from "@/components/CaseFileDocument";

// Public-by-token case-file view: the URL is the credential (unguessable token,
// never listed anywhere). No staff chrome, read-only.
export default async function SharedCaseFilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const caseFile = await db.caseFile.findUnique({
    where: { shareToken: token },
    include: { claim: { include: { evidenceItems: true } } },
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
    <main className="min-h-screen bg-slate-100 px-6 py-8">
      <CaseFileDocument
        content={caseFile.content as unknown as import("@/lib/types").CaseFileContent}
        evidence={evidence}
        version={caseFile.version}
        generatedAt={caseFile.createdAt}
        modelName={caseFile.model}
      />
      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-slate-400">
        Shared read-only case file · {caseFile.claim.reference}
      </p>
    </main>
  );
}
