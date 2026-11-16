"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * GUARDRAIL (do not remove): raw transcripts are always displayed next to the
 * audio with a visible "unverified" label. STT on accented English, Shona,
 * and Ndebele is error-prone — a human must be able to check the text against
 * the recording, and unverified text must never silently drive conclusions.
 */
export function TranscriptBlock({
  evidenceId,
  transcript,
  audioUrl,
}: {
  evidenceId: string;
  transcript: string | null;
  audioUrl: string | null;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/transcribe`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {audioUrl && <audio controls preload="none" src={audioUrl} className="h-9 w-full max-w-md" />}
      {transcript ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Unverified transcription — please confirm against the audio
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {transcript}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-sm text-slate-600">No transcript yet.</p>
          <Button size="sm" variant="secondary" onClick={handleRetry} isLoading={retrying}>
            {retrying ? "Transcribing…" : "Transcribe"}
          </Button>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
