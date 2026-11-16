import { notFound } from "next/navigation";
import { resolveClaimByPortalToken } from "@/lib/portal";
import { ClaimTimeline } from "@/components/ClaimTimeline";
import { PortalUpload, PortalRequestAnswer, PortalQuoteDecision } from "@/components/portal/PortalClient";
import { STATUS_LABELS, STATUS_STYLES, formatDate } from "@/lib/format";
import type { QuoteOption } from "@/services/quoteEngine";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await resolveClaimByPortalToken(token);
  if (!claim) notFound();

  const quote = claim.quotes[0];
  const quoteOptions = (quote?.recommendedOptions as unknown as QuoteOption[]) ?? [];
  const openRequests = claim.clientRequests.filter((r) => !r.respondedAt);
  const answeredRequests = claim.clientRequests.filter((r) => r.respondedAt);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Denga · Your claim
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{claim.reference}</h1>
          <p className="mt-1 text-sm text-slate-500">{claim.claimantName}</p>
          <span
            className={`mt-3 inline-block rounded-full border px-3 py-1 text-sm font-medium ${STATUS_STYLES[claim.status]}`}
          >
            {STATUS_LABELS[claim.status]}
          </span>
        </header>

        {/* Broker requests needing the client's action */}
        {openRequests.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold text-amber-800">We need a few things from you</h2>
            <ul className="mt-3 space-y-4">
              {openRequests.map((r) => (
                <li key={r.id} className="rounded-lg bg-white p-3">
                  <p className="text-sm font-medium text-slate-800">
                    {r.type === "DOCUMENT" ? "📎 " : "❓ "}
                    {r.prompt}
                  </p>
                  {r.type === "DOCUMENT" ? (
                    <div className="mt-2">
                      <PortalUpload token={token} />
                    </div>
                  ) : (
                    <PortalRequestAnswer token={token} requestId={r.id} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Quote */}
        {quote && (
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your quote</h2>
            <p className="mt-1 text-sm text-slate-600">{quote.clientSummary}</p>
            <p className="mt-2 text-sm font-medium text-emerald-700">{quote.estimatedPremiumRange}</p>
            <div className="mt-3 space-y-2">
              {quoteOptions.map((o, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${o.recommended ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{o.name}</p>
                    {o.recommended && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{o.coverage}</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{o.premiumRange}</p>
                </div>
              ))}
            </div>
            {quote.clientResponse ? (
              <p className="mt-3 text-sm font-medium text-slate-700">
                You {quote.clientResponse === "ACCEPTED" ? "accepted" : "declined"} this quote on{" "}
                {formatDate(quote.clientRespondedAt)}.
              </p>
            ) : (
              <PortalQuoteDecision token={token} quoteId={quote.id} />
            )}
            <p className="mt-3 text-xs text-slate-400">
              Indicative estimate only — the final premium is confirmed after underwriting.
            </p>
          </section>
        )}

        {/* Upload area (always available) */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Documents &amp; photos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add any photos or documents that support your claim.
          </p>
          <div className="mt-3">
            <PortalUpload token={token} />
          </div>
          {claim.evidenceItems.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {claim.evidenceItems.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2">
                  <span className="truncate text-slate-700">{e.fileName}</span>
                  <span className="text-xs text-slate-400">
                    {e.source === "PORTAL" ? "You" : "Broker"} · {formatDate(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Answered requests, for the client's reference */}
        {answeredRequests.length > 0 && (
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Your answers
            </h2>
            <ul className="mt-2 space-y-2 text-sm">
              {answeredRequests.map((r) => (
                <li key={r.id}>
                  <p className="text-slate-500">{r.prompt}</p>
                  <p className="text-slate-800">{r.response}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Progress timeline */}
        <section className="rounded-xl bg-white p-2 shadow-sm">
          <ClaimTimeline status={claim.status} events={claim.stageEvents} />
        </section>

        <p className="pb-6 text-center text-xs text-slate-400">
          This is your secure claim link from your broker. Please don&apos;t share it.
        </p>
      </div>
    </main>
  );
}
