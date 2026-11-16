import type { ClaimStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS, STATUS_FLOW, formatDate } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

interface StageEvent {
  id: string;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  note: string | null;
  actorEmail: string;
  createdAt: Date;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-2.5 w-2.5">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.004L4.29 10.2a1 1 0 1 1 1.42-1.408l3.088 3.114 6.492-6.583a1 1 0 0 1 1.414-.032Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Claim lifecycle view: a vertical stepper along the happy path plus the full
 * stage-history (every transition, who made it, when, and any note).
 */
export function ClaimTimeline({
  status,
  events,
}: {
  status: ClaimStatus;
  events: StageEvent[];
}) {
  const isRejected = status === "REJECTED";
  const currentIndex = STATUS_FLOW.indexOf(status);

  return (
    <Card>
      <CardHeader title="Lifecycle" />
      <CardBody className="px-5 py-4">
        {/* Vertical stepper */}
        <ol>
          {STATUS_FLOW.map((stage, i) => {
            const reached = !isRejected && currentIndex >= i;
            const isCurrent = !isRejected && currentIndex === i;
            const isLast = i === STATUS_FLOW.length - 1 && !isRejected;
            return (
              <li key={stage} className="relative flex gap-3 pb-4 last:pb-0">
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[9px] top-5 h-full w-px ${
                      reached && !isCurrent ? "bg-emerald-300" : "bg-slate-200"
                    }`}
                  />
                )}
                <span
                  aria-hidden="true"
                  className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${
                    isCurrent
                      ? "bg-slate-900 text-white ring-4 ring-slate-900/10"
                      : reached
                        ? "bg-emerald-500 text-white"
                        : "border border-slate-200 bg-white"
                  }`}
                >
                  {reached && !isCurrent && <CheckIcon />}
                </span>
                <span
                  className={`text-sm ${
                    isCurrent
                      ? "font-semibold text-slate-900"
                      : reached
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {STATUS_LABELS[stage]}
                </span>
              </li>
            );
          })}
          {isRejected && (
            <li className="relative flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-red-500 text-white"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-2.5 w-2.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-red-700">Rejected</span>
            </li>
          )}
        </ol>

        {/* History */}
        {events.length > 0 && (
          <ul className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
                />
                <div className="min-w-0">
                  <p className="text-slate-700">
                    {ev.fromStatus ? (
                      <>
                        <span className="text-slate-500">{STATUS_LABELS[ev.fromStatus]}</span>
                        <span aria-hidden="true" className="text-slate-400">
                          {" "}
                          →{" "}
                        </span>
                      </>
                    ) : null}
                    <span className="font-medium">{STATUS_LABELS[ev.toStatus]}</span>
                  </p>
                  {ev.note && <p className="text-xs text-slate-500">{ev.note}</p>}
                  <p className="text-xs text-slate-400">
                    {formatDate(ev.createdAt)} · {ev.actorEmail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
