"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ACCEPTED_EVIDENCE_TYPES, EVIDENCE_ACCEPT_ATTRIBUTE } from "@/lib/evidenceTypes";

export function EvidenceUploader({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (incoming: FileList | File[]) => {
      const files = Array.from(incoming).filter((f) => ACCEPTED_EVIDENCE_TYPES.includes(f.type));
      const rejected = Array.from(incoming).length - files.length;
      if (rejected > 0) {
        setError(`${rejected} file(s) skipped — photos (JPG/PNG), PDFs, and voicenotes (OGG/MP3/M4A/WAV) only.`);
      } else {
        setError(null);
      }
      if (files.length === 0) return;

      setUploading(true);
      try {
        // Ask the server for direct-to-storage upload URLs (bypasses request
        // body limits on serverless hosts). Falls back to multipart proxy.
        const prepRes = await fetch(`/api/claims/${claimId}/evidence/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: files.map((f) => ({ fileName: f.name, mimeType: f.type, sizeBytes: f.size })),
          }),
        });
        const prep = await prepRes.json();
        if (!prepRes.ok) throw new Error(prep.error || "Upload failed.");

        if (prep.mode === "direct") {
          for (let i = 0; i < files.length; i++) {
            const putRes = await fetch(prep.uploads[i].uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": files[i].type },
              body: files[i],
            });
            if (!putRes.ok) throw new Error(`Upload of "${files[i].name}" failed. Please retry.`);
          }
          const confirmRes = await fetch(`/api/claims/${claimId}/evidence/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: files.map((f, i) => ({
                fileName: f.name,
                mimeType: f.type,
                storageKey: prep.uploads[i].storageKey,
              })),
            }),
          });
          const confirm = await confirmRes.json();
          if (!confirmRes.ok) throw new Error(confirm.error || "Upload failed.");
        } else {
          const formData = new FormData();
          files.forEach((f) => formData.append("files", f));
          const res = await fetch(`/api/claims/${claimId}/evidence`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed.");
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [claimId, router]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload evidence — drag and drop or press Enter to browse"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 ${
          isDragging ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50/50 hover:border-slate-400 hover:bg-slate-50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"
        >
          {uploading ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path
                fillRule="evenodd"
                d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z"
                clipRule="evenodd"
              />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
          )}
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700">
          {uploading ? "Uploading…" : "Drag and drop evidence here"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          or click to browse — photos, PDFs, and voicenotes (JPG, PNG, PDF, OGG, MP3, M4A, WAV)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={EVIDENCE_ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
