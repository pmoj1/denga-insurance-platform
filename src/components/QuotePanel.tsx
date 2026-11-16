"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { QuoteOption } from "@/services/quoteEngine";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export interface QuotePanelData {
  id: string;
  insuranceType: string;
  assetValue: string | null;
  estimatedPremiumRange: string;
  recommendedOptions: QuoteOption[];
  assumptions: string[];
  recommendation: string;
  clientMessage: string;
  followUpDueAt: string | null;
  sentAt: string | null;
}

export function QuotePanel({
  claimId,
  hasIntake,
  quote,
}: {
  claimId: string;
  hasIntake: boolean;
  quote: QuotePanelData | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/quote`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate quote.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate quote.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not prepare the message.");
      setShowMessage(true);
      try {
        await navigator.clipboard.writeText(data.clientMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* clipboard may be blocked; the message is shown below to copy manually */
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Quote"
        actions={
          <Button
            size="sm"
            variant={quote ? "secondary" : "primary"}
            onClick={generate}
            isLoading={busy && !showMessage}
            disabled={!hasIntake}
            title={hasIntake ? undefined : "Run smart intake first"}
          >
            {busy ? "Working…" : quote ? "Regenerate quote" : "Generate quote"}
          </Button>
        }
      />
      <CardBody className="px-5 py-4">
        {!hasIntake && (
          <p className="text-sm text-slate-500">
            Add the client&apos;s message via smart intake to generate a quote from it.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {quote && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="neutral">{quote.insuranceType}</Badge>
              {quote.assetValue && <Badge tone="neutral">Value: {quote.assetValue}</Badge>}
              <Badge tone="success">{quote.estimatedPremiumRange}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {quote.recommendedOptions.map((o, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 transition ${
                    o.recommended
                      ? "border-sky-400 bg-sky-50/60 ring-1 ring-sky-400/30"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{o.name}</p>
                    {o.recommended && <Badge tone="brand">Recommended</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{o.coverage}</p>
                  <p className="mt-2.5 text-sm font-semibold tabular-nums text-slate-900">
                    {o.premiumRange}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm leading-relaxed text-slate-700">
              <span className="font-medium">Recommendation:</span> {quote.recommendation}
            </p>

            <details className="text-sm">
              <summary className="cursor-pointer rounded text-xs text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20">
                Assumptions &amp; disclaimer
              </summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-500">
                {quote.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <Button onClick={send} isLoading={busy}>
                {copied ? "Message copied!" : "Send quote to client"}
              </Button>
              {quote.sentAt && (
                <span className="text-xs text-slate-500">
                  Marked sent · follow up by{" "}
                  {quote.followUpDueAt
                    ? new Date(quote.followUpDueAt).toLocaleString("en-GB")
                    : "24–48h"}
                </span>
              )}
            </div>

            {showMessage && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Client-ready message · paste into WhatsApp / email
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                  {quote.clientMessage}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
