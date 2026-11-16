import type { CaseFileContent } from "@/lib/types";
import { CASE_FILE_SCHEMA } from "@/config/caseFileSchema";
import { formatDate } from "@/lib/format";

function label(key: string): string {
  return CASE_FILE_SCHEMA.find((f) => f.key === key)?.label ?? key;
}

export interface EvidenceDisplayItem {
  id: string;
  fileName: string;
  type: string;
  sha256: string;
  /** signed/thumbnail URL for images; null when unavailable */
  imageUrl: string | null;
  /** unverified machine transcript for audio evidence */
  transcript?: string | null;
}

export function CaseFileDocument({
  content,
  evidence,
  version,
  generatedAt,
  modelName,
}: {
  content: CaseFileContent;
  evidence: EvidenceDisplayItem[];
  version: number;
  generatedAt: Date;
  modelName: string;
}) {
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const fileNameFor = (id: string) => evidenceById.get(id)?.fileName ?? id;

  const citeList = (ids: string[] | undefined) =>
    ids && ids.length > 0 ? (
      <span className="text-xs text-slate-400"> — sources: {ids.map(fileNameFor).join(", ")}</span>
    ) : null;

  return (
    <article className="print-page mx-auto max-w-3xl rounded-xl bg-white p-10 shadow-sm print:shadow-none">
      <header className="border-b border-slate-200 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Case File Summary
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{content.claimant}</h1>
          </div>
          <p className="text-right text-xs text-slate-400">
            Version {version}
            <br />
            Generated {formatDate(generatedAt)}
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(["claimReference", "dateOfIncident", "policyNumber", "coveredAsset"] as const).map(
            (key) => (
              <div key={key}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{label(key)}</dt>
                <dd className="text-sm font-medium text-slate-800">{content[key]}</dd>
              </div>
            )
          )}
        </dl>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {label("incidentSummary")}
        </h2>
        <p className="mt-2 leading-relaxed text-slate-700">{content.incidentSummary}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {label("itemsClaimed")}
        </h2>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {content.itemsClaimed.map((item, i) => (
              <tr key={i}>
                <td className="py-2 pr-4 text-slate-700">
                  {item.description}
                  {citeList(item.evidenceItemIds)}
                </td>
                <td className="py-2 text-right font-medium text-slate-900 whitespace-nowrap align-top">
                  {item.statedValue ?? "—"}
                </td>
              </tr>
            ))}
            {content.itemsClaimed.length === 0 && (
              <tr>
                <td className="py-2 text-slate-500">No items identified in the evidence.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {label("evidenceInventory")}
        </h2>
        <div className="mt-3 space-y-3">
          {content.evidenceInventory.map((entry, i) => {
            const item = evidenceById.get(entry.evidenceItemId);
            return (
              <div key={i} className="flex gap-3 rounded-lg border border-slate-200 p-3">
                {item?.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived external URLs
                  <img
                    src={item.imageUrl}
                    alt={entry.fileName}
                    className="h-20 w-20 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{entry.fileName}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {entry.type}
                    </span>
                    {item ? (
                      <span
                        className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                        title={`SHA-256: ${item.sha256}`}
                      >
                        integrity recorded
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        unmatched citation
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{entry.whatItShows}</p>
                  {entry.keyDetails && (
                    <p className="mt-1 text-xs text-slate-500">Key details: {entry.keyDetails}</p>
                  )}
                  {item?.transcript && (
                    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Unverified transcription — confirm against the audio
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-800">
                        {item.transcript}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          {label("reviewFlags")}
        </h2>
        <p className="mt-1 text-xs text-amber-700">
          Surfaced for human review — these are questions to examine, not an automated assessment.
        </p>
        {content.reviewFlags.length === 0 ? (
          <p className="mt-2 text-sm text-amber-900">
            No inconsistencies or gaps were identified across the evidence.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {content.reviewFlags.map((flag, i) => (
              <li key={i} className="rounded-md border border-amber-200 bg-white/60 p-3">
                <p className="text-sm font-medium text-amber-900">{flag.summary}</p>
                <p className="mt-1 text-sm text-amber-800">{flag.explanation}</p>
                {flag.evidenceItemIds.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Evidence: {flag.evidenceItemIds.map(fileNameFor).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          {label("underwriterNotes")}
        </h2>
        <p className="mt-2 text-sm text-blue-900">{content.underwriterNotes}</p>
      </section>

      <footer className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">
        Generated by {modelName}. AI-assisted summary — verify against the underlying evidence before
        any coverage decision.
      </footer>
    </article>
  );
}
