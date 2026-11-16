"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { IntakeExtraction } from "@/lib/ai/intake";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";

const URGENCY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
};

function SparkleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M11.983 1.907a.75.75 0 0 0-1.417-.043l-1.09 3.14a2.25 2.25 0 0 1-1.386 1.386l-3.14 1.09a.75.75 0 0 0 .043 1.417l3.164.94a2.25 2.25 0 0 1 1.437 1.437l.94 3.164a.75.75 0 0 0 1.417-.043l1.09-3.14a2.25 2.25 0 0 1 1.386-1.386l3.14-1.09a.75.75 0 0 0-.043-1.417l-3.164-.94a2.25 2.25 0 0 1-1.437-1.437l-.94-3.164ZM6.75 12.25a.75.75 0 0 0-1.5 0v.5h-.5a.75.75 0 0 0 0 1.5h.5v.5a.75.75 0 0 0 1.5 0v-.5h.5a.75.75 0 0 0 0-1.5h-.5v-.5Z" />
    </svg>
  );
}

export default function NewClaimPage() {
  const router = useRouter();
  const [claimantName, setClaimantName] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Smart intake state
  const [rawMessage, setRawMessage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [intake, setIntake] = useState<IntakeExtraction | null>(null);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setIntakeError(null);
    try {
      const res = await fetch("/api/intake/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: rawMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      const extracted: IntakeExtraction = data.intake;
      setIntake(extracted);
      // Pre-fill the form — the handler reviews before creating.
      if (extracted.prefill.claimant_name) setClaimantName(extracted.prefill.claimant_name);
      if (extracted.prefill.policy_number) setPolicyNumber(extracted.prefill.policy_number);
      if (extracted.prefill.incident_date) setIncidentDate(extracted.prefill.incident_date);
      if (extracted.prefill.incident_description)
        setIncidentDescription(extracted.prefill.incident_description);
    } catch (err) {
      setIntakeError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimantName,
          policyNumber,
          incidentDate,
          incidentDescription,
          intakeRaw: intake ? rawMessage : undefined,
          intake: intake ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create claim.");
      router.push(`/claims/${data.claim.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
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
            New claim
          </li>
        </ol>
      </nav>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New claim</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          First notification of loss. You can add evidence on the next screen.
        </p>
      </div>

      {/* Smart intake */}
      <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 shadow-sm">
        <div className="border-b border-blue-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <span className="text-blue-600">
              <SparkleIcon />
            </span>
            Smart intake
          </h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs leading-relaxed text-blue-800">
            Paste the client&apos;s message — WhatsApp text, email, or a voicenote transcript — and
            Denga will pre-fill the form. Review everything before creating the claim.
          </p>
          <div className="mt-3">
            <label htmlFor="raw-message" className="sr-only">
              Client message
            </label>
            <Textarea
              id="raw-message"
              rows={4}
              value={rawMessage}
              onChange={(e) => setRawMessage(e.target.value)}
              placeholder={'e.g. "Makadii, someone hit my Corolla at Fife Ave this morning, the door is smashed, I have comprehensive cover, policy ZW-4471..."'}
              className="border-blue-200 focus:border-blue-500 focus:ring-blue-500/10"
            />
          </div>
          <div className="mt-2.5">
            <Button
              type="button"
              variant="brand"
              onClick={handleAnalyze}
              isLoading={analyzing}
              disabled={!rawMessage.trim()}
            >
              {analyzing ? "Analysing…" : "Analyse & pre-fill"}
            </Button>
          </div>
          {intakeError && (
            <p
              role="alert"
              className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {intakeError}
            </p>
          )}

          {intake && (
            <div className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-medium ${URGENCY_STYLES[intake.urgency]}`}
                >
                  {intake.urgency.toUpperCase()} urgency
                </span>
                <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                  {intake.insurance_type}
                </Badge>
                {intake.asset_value && (
                  <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                    Stated value: {intake.asset_value}
                  </Badge>
                )}
                {intake.location && (
                  <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                    {intake.location}
                  </Badge>
                )}
              </div>
              {intake.action_required && (
                <p className="text-sm text-slate-700">
                  <span className="font-medium">Next action:</span> {intake.action_required}
                </p>
              )}
              {intake.risk_flags.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    For review — not an automated assessment
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {intake.risk_flags.map((f, i) => (
                      <li key={i} className="text-sm text-amber-900">
                        <span className="font-medium">{f.summary}</span> — {f.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {intake.follow_up_required && intake.follow_up_questions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ask the client
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {intake.follow_up_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                AI-extracted from the pasted message — verify before creating the claim.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Claim form */}
      <Card className="mt-6">
        <CardBody className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Claimant name *" htmlFor="claimantName">
              <Input
                id="claimantName"
                required
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Policy number" htmlFor="policyNumber">
                <Input
                  id="policyNumber"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                />
              </Field>
              <Field label="Incident date" htmlFor="incidentDate">
                <Input
                  id="incidentDate"
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Incident description" htmlFor="incidentDescription">
              <Textarea
                id="incidentDescription"
                rows={4}
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                placeholder="What happened, as reported by the claimant"
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <Button type="submit" isLoading={submitting}>
              {submitting ? "Creating…" : "Create claim"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
