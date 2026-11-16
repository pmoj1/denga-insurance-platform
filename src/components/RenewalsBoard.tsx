"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";

export interface RenewalRow {
  policyId: string;
  policyNumber: string;
  clientName: string;
  insuranceType: string;
  expiryDate: string;
  tier: string;
  tierLabel: string;
  daysUntil: number;
  renewalId: string | null;
  renewalStatus: string | null;
  quoteRange: string | null;
  draftMessage: string | null;
}

const TIER_TONES: Record<string, BadgeTone> = {
  OVERDUE: "danger",
  DUE: "danger",
  D30: "warning",
  D60: "info",
  D90: "neutral",
};

/* ---------- pipeline step indicator (presentational) ---------- */

const PIPELINE_STEPS = ["Prepare", "Approve", "Send"] as const;

function pipelineIndex(status: string | null): number {
  if (!status || status === "PENDING") return 0;
  if (status === "DRAFTED") return 1;
  if (status === "APPROVED") return 2;
  if (status === "SENT") return 3;
  return -1; // DECLINED / COMPLETED — pipeline not shown
}

function PipelineSteps({ status }: { status: string | null }) {
  const current = pipelineIndex(status);
  if (current < 0) return null;

  return (
    <ol className="flex items-center gap-1.5" aria-label="Renewal progress">
      {PIPELINE_STEPS.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <li key={step} className="flex items-center gap-1.5">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`h-px w-5 ${isDone || isCurrent ? "bg-slate-400" : "bg-slate-200"}`}
              />
            )}
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${
                  isDone
                    ? "bg-slate-900 text-white"
                    : isCurrent
                      ? "bg-white text-slate-900 ring-2 ring-sky-500"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-2.5 w-2.5">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.004L4.29 10.2a1 1 0 1 1 1.42-1.408l3.088 3.114 6.492-6.583a1 1 0 0 1 1.414-.032Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={`text-xs ${isCurrent ? "font-medium text-slate-900" : "text-slate-400"}`}>
                {step}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- add-policy form (same payload + endpoint) ---------- */

const EMPTY_FORM = {
  policyNumber: "",
  clientName: "",
  insuranceType: "Motor",
  assetValue: "",
  premium: "",
  expiryDate: "",
};

function NewPolicyForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState(EMPTY_FORM);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setF({ ...f, [key]: value });
    if (fieldErrors[key]) {
      setFieldErrors(Object.fromEntries(Object.entries(fieldErrors).filter(([k]) => k !== key)));
    }
  };

  const submit = async () => {
    // Presentational pre-check only — the API stays the source of truth.
    const missing: Record<string, string> = {};
    if (!f.policyNumber.trim()) missing.policyNumber = "Policy number is required.";
    if (!f.clientName.trim()) missing.clientName = "Client name is required.";
    if (!f.expiryDate) missing.expiryDate = "Expiry date is required.";
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add policy.");
      setOpen(false);
      setF(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add policy.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Add policy</Button>;
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">New policy</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Track a policy so its renewal shows up in the queue automatically.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Policy number *" htmlFor="np-number" error={fieldErrors.policyNumber}>
          <Input
            id="np-number"
            placeholder="POL-MOT-1234"
            value={f.policyNumber}
            onChange={(e) => setField("policyNumber", e.target.value)}
          />
        </Field>
        <Field label="Client name *" htmlFor="np-client" error={fieldErrors.clientName}>
          <Input
            id="np-client"
            placeholder="Full name"
            value={f.clientName}
            onChange={(e) => setField("clientName", e.target.value)}
          />
        </Field>
        <Field label="Insurance type" htmlFor="np-type">
          <Input
            id="np-type"
            placeholder="Motor, Property…"
            value={f.insuranceType}
            onChange={(e) => setField("insuranceType", e.target.value)}
          />
        </Field>
        <Field label="Asset value" htmlFor="np-asset" helper="Used for the indicative renewal quote.">
          <Input
            id="np-asset"
            placeholder="USD 12,000"
            value={f.assetValue}
            onChange={(e) => setField("assetValue", e.target.value)}
          />
        </Field>
        <Field label="Current premium" htmlFor="np-premium" helper="Optional.">
          <Input
            id="np-premium"
            placeholder="USD 40 / month"
            value={f.premium}
            onChange={(e) => setField("premium", e.target.value)}
          />
        </Field>
        <Field label="Expiry date *" htmlFor="np-expiry" error={fieldErrors.expiryDate}>
          <Input
            id="np-expiry"
            type="date"
            value={f.expiryDate}
            onChange={(e) => setField("expiryDate", e.target.value)}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} isLoading={busy}>
          {busy ? "Saving…" : "Save policy"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

/* ---------- renewal actions (same endpoints + transitions) ---------- */

function RenewalActions({ row }: { row: RenewalRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const prepare = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/renewals/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: row.policyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not prepare renewal.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare renewal.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "approve" | "send" | "decline") => {
    if (!row.renewalId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/renewals/${row.renewalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      if (action === "send" && data.draftMessage) {
        setMessage(data.draftMessage);
        try {
          await navigator.clipboard.writeText(data.draftMessage);
        } catch {
          /* shown below to copy manually */
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PipelineSteps status={row.renewalStatus} />
        <div className="flex flex-wrap items-center gap-2">
          {!row.renewalId && (
            <Button size="sm" onClick={prepare} isLoading={busy}>
              {busy ? "Preparing…" : "Prepare renewal"}
            </Button>
          )}
          {row.renewalStatus === "DRAFTED" && (
            <>
              <Button size="sm" onClick={() => act("approve")} isLoading={busy}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={prepare} disabled={busy}>
                Regenerate
              </Button>
            </>
          )}
          {row.renewalStatus === "APPROVED" && (
            <Button size="sm" onClick={() => act("send")} isLoading={busy}>
              Send to client
            </Button>
          )}
          {row.renewalStatus === "SENT" && <Badge tone="success">Sent to client</Badge>}
          {row.renewalStatus === "DECLINED" && <Badge tone="neutral">Not renewing</Badge>}
          {row.renewalStatus && row.renewalStatus !== "SENT" && row.renewalStatus !== "DECLINED" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:bg-red-50 hover:text-red-600"
              onClick={() => act("decline")}
              disabled={busy}
            >
              Not renewing
            </Button>
          )}
        </div>
      </div>
      {row.quoteRange && (
        <p className="mt-2 text-xs text-slate-500">Indicative renewal: {row.quoteRange}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      {(message || (row.renewalStatus === "SENT" && row.draftMessage)) && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Client message · copied to clipboard — paste into WhatsApp / email
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
            {message ?? row.draftMessage}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ---------- board ---------- */

export function RenewalsBoard({ rows }: { rows: RenewalRow[] }) {
  return (
    <div>
      <div className="mb-5">
        <NewPolicyForm />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No renewals due in the next 90 days"
          description="Add a policy with an upcoming expiry to see it here."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.policyId}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {row.policyNumber}
                      <span className="font-normal text-slate-400"> · </span>
                      <span className="font-normal text-slate-700">{row.clientName}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {row.insuranceType} · expires{" "}
                      <span className="tabular-nums">
                        {new Date(row.expiryDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {row.daysUntil >= 0 ? ` (${row.daysUntil} days)` : " (overdue)"}
                    </p>
                  </div>
                  <Badge tone={TIER_TONES[row.tier] ?? "neutral"}>{row.tierLabel}</Badge>
                </div>
                <RenewalActions row={row} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
