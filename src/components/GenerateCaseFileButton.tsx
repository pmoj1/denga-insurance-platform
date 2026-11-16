"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function GenerateCaseFileButton({
  claimId,
  evidenceCount,
  hasExisting,
}: {
  claimId: string;
  evidenceCount: number;
  hasExisting: boolean;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      router.push(`/claims/${claimId}/case-file/${data.caseFile.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setGenerating(false);
    }
  };

  return (
    <div>
      <Button
        onClick={handleGenerate}
        isLoading={generating}
        disabled={evidenceCount === 0}
        title={evidenceCount === 0 ? "Upload evidence first" : undefined}
        className="w-full"
      >
        {generating
          ? "Generating case file… up to a minute"
          : hasExisting
            ? "Regenerate case file"
            : "Generate case file"}
      </Button>
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
