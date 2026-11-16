import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { StatusSelect } from "@/components/StatusSelect";
import { GenerateCaseFileButton } from "@/components/GenerateCaseFileButton";
import { TranscriptBlock } from "@/components/TranscriptBlock";
import { ClaimTimeline } from "@/components/ClaimTimeline";
import { NextActionPanel } from "@/components/NextActionPanel";
import { QuotePanel, type QuotePanelData } from "@/components/QuotePanel";
import { ClientPortalManager } from "@/components/ClientPortalManager";
import { computeNextAction, type IntakeData } from "@/services/nextActionEngine";
import type { QuoteOption } from "@/services/quoteEngine";
import { getStorage } from "@/lib/storage";
import { formatBytes, formatDate } from "@/lib/format";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const TYPE_LABELS: Record<string, string> = {
  IMAGE: "Photo",
  PDF: "PDF",
  AUDIO: "Audio",
  OTHER: "File",
};

const TYPE_ICON_STYLES: Record<string, string> = {
  IMAGE: "bg-sky-50 text-sky-600",
  PDF: "bg-red-50 text-red-500",
  AUDIO: "bg-violet-50 text-violet-500",
  OTHER: "bg-slate-100 text-slate-500",
};

function EvidenceTypeIcon({ type }: { type: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_ICON_STYLES[type] ?? TYPE_ICON_STYLES.OTHER}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        {type === "IMAGE" ? (
          <path
            fillRule="evenodd"
            d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909.47.47a.75.75 0 1 1-1.06 1.06l-6.97-6.97a.75.75 0 0 0-1.06 0l-1.19 1.19ZM12 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z"
            clipRule="evenodd"
          />
        ) : type === "AUDIO" ? (
          <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167A1.167 1.167 0 0 0 2 8.167v3.666C2 12.478 2.522 13 3.167 13h1.536l4.033 3.796A.75.75 0 0 0 10 16.25V3.75ZM15.95 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899Z" />
        ) : (
          <path
            fillRule="evenodd"
            d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"
            clipRule="evenodd"
          />
        )}
      </svg>
    </span>
  );
}

function FlagIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
    >
      <path
        fillRule="evenodd"
        d="M3 2.75A.75.75 0 0 1 3.75 2h.5a.75.75 0 0 1 .75.75V3h9.75a.75.75 0 0 1 .6 1.2L13.25 7.5l2.1 3.3a.75.75 0 0 1-.6 1.2H5v5.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V2.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const claim = await db.claim.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      evidenceItems: { orderBy: { createdAt: "asc" }, include: { uploadedBy: { select: { name: true } } } },
      caseFiles: { orderBy: { version: "desc" }, select: { id: true, version: true, createdAt: true } },
      createdBy: { select: { name: true } },
      stageEvents: { orderBy: { createdAt: "asc" } },
      quotes: { orderBy: { createdAt: "desc" }, take: 1 },
      clientRequests: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!claim) notFound();

  // Audio evidence gets a playable signed URL so handlers can verify transcripts.
  const storage = getStorage();
  const audioUrls = new Map<string, string | null>();
  for (const item of claim.evidenceItems) {
    if (item.type === "AUDIO") {
      audioUrls.set(item.id, await storage.signedUrl(item.storageKey).catch(() => null));
    }
  }

  // Next Action Engine (Step 1.2): computed live, never stored — always current.
  const nextAction = computeNextAction({
    status: claim.status,
    hasPolicyNumber: Boolean(claim.policyNumber),
    hasIncidentDate: Boolean(claim.incidentDate),
    imageCount: claim.evidenceItems.filter((e) => e.type === "IMAGE").length,
    pdfCount: claim.evidenceItems.filter((e) => e.type === "PDF").length,
    audioCount: claim.evidenceItems.filter((e) => e.type === "AUDIO").length,
    untranscribedAudioCount: claim.evidenceItems.filter((e) => e.type === "AUDIO" && !e.transcript)
      .length,
    hasCaseFile: claim.caseFiles.length > 0,
    intake: (claim.intake as IntakeData | null) ?? null,
  });

  const intakeData = (claim.intake as IntakeData | null) ?? null;
  const latestQuote = claim.quotes[0];
  const quotePanelData: QuotePanelData | null = latestQuote
    ? {
        id: latestQuote.id,
        insuranceType: latestQuote.insuranceType,
        assetValue: latestQuote.assetValue,
        estimatedPremiumRange: latestQuote.estimatedPremiumRange,
        recommendedOptions: latestQuote.recommendedOptions as unknown as QuoteOption[],
        assumptions: latestQuote.assumptions as unknown as string[],
        recommendation: latestQuote.recommendation,
        clientMessage: latestQuote.clientMessage,
        followUpDueAt: latestQuote.followUpDueAt?.toISOString() ?? null,
        sentAt: latestQuote.sentAt?.toISOString() ?? null,
      }
    : null;

  const intake = claim.intake as {
    insurance_type?: string;
    asset_value?: string;
    location?: string;
    urgency?: string;
    action_required?: string;
    risk_flags?: { summary: string; explanation: string }[];
    follow_up_required?: boolean;
    follow_up_questions?: string[];
  } | null;

  const urgencyStyle =
    intake?.urgency === "high"
      ? "bg-red-100 text-red-700"
      : intake?.urgency === "medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link
              href="/claims"
              className="rounded text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
            >
              Claims
            </Link>
          </li>
          <li aria-hidden="true" className="text-slate-300">
            /
          </li>
          <li className="font-medium text-slate-700" aria-current="page">
            {claim.reference}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {claim.reference}
            </h1>
            <Badge className={STATUS_STYLES[claim.status]}>{STATUS_LABELS[claim.status]}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            {claim.claimantName}
            {claim.policyNumber ? ` · Policy ${claim.policyNumber}` : ""} · Incident{" "}
            {formatDate(claim.incidentDate)} · Created {formatDate(claim.createdAt)} by{" "}
            {claim.createdBy.name}
          </p>
        </div>
        <StatusSelect claimId={claim.id} status={claim.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main workflow column */}
        <div className="space-y-4 lg:col-span-2">
          <NextActionPanel action={nextAction} />

          <QuotePanel
            claimId={claim.id}
            hasIntake={Boolean(intakeData?.insurance_type)}
            quote={quotePanelData}
          />

          <ClientPortalManager
            claimId={claim.id}
            hasToken={Boolean(claim.clientAccessToken)}
            requests={claim.clientRequests.map((r) => ({
              id: r.id,
              type: r.type,
              prompt: r.prompt,
              response: r.response,
              respondedAt: r.respondedAt?.toISOString() ?? null,
            }))}
          />

          {claim.incidentDescription && (
            <Card>
              <CardHeader title="Reported incident" />
              <CardBody className="px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {claim.incidentDescription}
                </p>
              </CardBody>
            </Card>
          )}

          {intake && (
            <section className="rounded-2xl border border-blue-200 bg-blue-50/50 shadow-sm">
              <div className="border-b border-blue-100 px-5 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Smart intake · AI-extracted — verify against the original message
                </h2>
              </div>
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {intake.urgency && (
                    <span className={`rounded-full px-2.5 py-0.5 font-medium ${urgencyStyle}`}>
                      {intake.urgency.toUpperCase()} urgency
                    </span>
                  )}
                  {intake.insurance_type && (
                    <Badge className="border-slate-200 bg-white text-slate-600">
                      {intake.insurance_type}
                    </Badge>
                  )}
                  {intake.asset_value && (
                    <Badge className="border-slate-200 bg-white text-slate-600">
                      Stated value: {intake.asset_value}
                    </Badge>
                  )}
                  {intake.location && (
                    <Badge className="border-slate-200 bg-white text-slate-600">
                      {intake.location}
                    </Badge>
                  )}
                </div>
                {intake.action_required && (
                  <p className="mt-3 text-sm text-slate-700">
                    <span className="font-medium">Next action:</span> {intake.action_required}
                  </p>
                )}
                {(intake.risk_flags?.length ?? 0) > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {intake.risk_flags!.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                        <FlagIcon />
                        <span>
                          <span className="font-medium">{f.summary}</span> — {f.explanation}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {intake.follow_up_required && (intake.follow_up_questions?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ask the client
                    </p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {intake.follow_up_questions!.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {claim.intakeRaw && (
                  <details className="mt-4">
                    <summary className="cursor-pointer rounded text-xs text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20">
                      Original client message (verbatim)
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700">
                      {claim.intakeRaw}
                    </p>
                  </details>
                )}
              </div>
            </section>
          )}

          {/* Evidence */}
          <Card>
            <CardHeader title="Evidence" count={claim.evidenceItems.length} />
            <CardBody className="px-5 py-4">
              <EvidenceUploader claimId={claim.id} />
              {claim.evidenceItems.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100">
                  {claim.evidenceItems.map((item) => (
                    <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <EvidenceTypeIcon type={item.type} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {TYPE_LABELS[item.type]} · {formatBytes(item.sizeBytes)} · uploaded{" "}
                            {formatDate(item.createdAt)} by {item.uploadedBy.name}
                          </p>
                          <p
                            className="mt-0.5 font-mono text-[10px] text-slate-400"
                            title="SHA-256 integrity hash"
                          >
                            sha256: {item.sha256.slice(0, 16)}…
                          </p>
                        </div>
                      </div>
                      {item.type === "AUDIO" && (
                        <TranscriptBlock
                          evidenceId={item.id}
                          transcript={item.transcript}
                          audioUrl={audioUrls.get(item.id) ?? null}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <ClaimTimeline status={claim.status} events={claim.stageEvents} />

          <Card>
            <CardHeader title="Case file" count={claim.caseFiles.length} />
            <CardBody className="space-y-4 px-5 py-4">
              <GenerateCaseFileButton
                claimId={claim.id}
                evidenceCount={claim.evidenceItems.length}
                hasExisting={claim.caseFiles.length > 0}
              />
              {claim.caseFiles.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Upload the claim&apos;s evidence, then generate a structured case file for
                  underwriter review.
                </p>
              ) : (
                <ul className="space-y-1">
                  {claim.caseFiles.map((cf) => (
                    <li key={cf.id}>
                      <Link
                        href={`/claims/${claim.id}/case-file/${cf.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
                      >
                        <span className="font-medium text-brand hover:underline">
                          Version {cf.version}
                        </span>
                        <span className="text-xs tabular-nums text-slate-400">
                          {formatDate(cf.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  );
}
