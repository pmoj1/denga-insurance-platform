"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";

export interface ClientRequestView {
  id: string;
  type: "QUESTION" | "DOCUMENT";
  prompt: string;
  response: string | null;
  respondedAt: string | null;
}

/**
 * Broker-side control for the Client Portal (Feature 1): create/copy the secure
 * client link, ask the client for information or documents, and see their replies.
 */
export function ClientPortalManager({
  claimId,
  hasToken,
  requests,
}: {
  claimId: string;
  hasToken: boolean;
  requests: ClientRequestView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<"QUESTION" | "DOCUMENT">("QUESTION");

  const createOrCopyLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/portal-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the link.");
      const url = `${window.location.origin}/portal/${data.token}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        window.prompt("Client portal link:", url);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the link.");
    } finally {
      setBusy(false);
    }
  };

  const addRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/client-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add the request.");
      setPrompt("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Client portal"
        actions={
          <Button size="sm" variant="secondary" onClick={createOrCopyLink} isLoading={busy && !prompt}>
            {copied ? "Link copied ✓" : hasToken ? "Copy client link" : "Create client link"}
          </Button>
        }
      />
      <CardBody className="px-5 py-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ask the client for something
          </p>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-36">
              <label htmlFor="portal-request-type" className="sr-only">
                Request type
              </label>
              <Select
                id="portal-request-type"
                value={type}
                onChange={(e) => setType(e.target.value as "QUESTION" | "DOCUMENT")}
                className="py-2"
              >
                <option value="QUESTION">Question</option>
                <option value="DOCUMENT">Document</option>
              </Select>
            </div>
            <div className="flex-1">
              <label htmlFor="portal-request-prompt" className="sr-only">
                Request for the client
              </label>
              <Input
                id="portal-request-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  type === "DOCUMENT"
                    ? "e.g. Upload your driver's licence"
                    : "e.g. What time did the incident happen?"
                }
                className="py-2"
              />
            </div>
            <Button onClick={addRequest} disabled={busy || !prompt.trim()}>
              Add
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {requests.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-100 p-3.5">
                <div className="flex items-start gap-2">
                  <Badge tone={r.type === "DOCUMENT" ? "info" : "neutral"}>
                    {r.type === "DOCUMENT" ? "Document" : "Question"}
                  </Badge>
                  <p className="min-w-0 text-slate-700">{r.prompt}</p>
                </div>
                {r.respondedAt ? (
                  <p className="mt-2 flex items-start gap-1.5 text-emerald-700">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.004L4.29 10.2a1 1 0 1 1 1.42-1.408l3.088 3.114 6.492-6.583a1 1 0 0 1 1.414-.032Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {r.response ? r.response : "Provided"}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-amber-600">Awaiting client…</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
