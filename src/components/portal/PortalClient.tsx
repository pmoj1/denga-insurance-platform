"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPTED_EVIDENCE_TYPES, EVIDENCE_ACCEPT_ATTRIBUTE } from "@/lib/evidenceTypes";

export function PortalUpload({ token }: { token: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const upload = async (files: FileList) => {
    const list = Array.from(files).filter((f) => ACCEPTED_EVIDENCE_TYPES.includes(f.type));
    if (list.length === 0) {
      setError("Please choose photos, PDFs or voicenotes.");
      return;
    }
    setUploading(true);
    setError(null);
    setDone(false);
    try {
      for (const file of list) {
        const prep = await fetch(`/api/portal/${token}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
        }).then((r) => r.json());
        if (prep.error) throw new Error(prep.error);
        if (prep.mode !== "direct") throw new Error("Uploads are temporarily unavailable.");

        const put = await fetch(prep.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`Could not upload "${file.name}".`);

        const confirm = await fetch(`/api/portal/${token}/upload-confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, storageKey: prep.storageKey }),
        }).then((r) => r.json());
        if (confirm.error) throw new Error(confirm.error);
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload photos or documents"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={EVIDENCE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
      {done && <p className="mt-2 text-sm text-emerald-700">Thank you — your files were received.</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function PortalRequestAnswer({ token, requestId }: { token: string; requestId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, response: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your answer.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your answer.");
      setSaving(false);
    }
  };

  return (
    <div className="mt-2">
      <textarea
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={saving || !value.trim()}
        className="mt-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
      >
        {saving ? "Sending…" : "Send answer"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function PortalQuoteDecision({ token, quoteId }: { token: string; quoteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "ACCEPTED" | "REJECTED") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}/quote-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record your decision.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your decision.");
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={() => decide("ACCEPTED")}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Accept quote
      </button>
      <button
        onClick={() => decide("REJECTED")}
        disabled={busy}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Decline
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
