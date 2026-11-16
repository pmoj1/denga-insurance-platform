import type { NextAction, UrgencyLevel } from "@/services/nextActionEngine";

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  high: "bg-red-100 text-red-700 border-red-200",
};

function CheckboxIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500">
      <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Next Action Panel (Step 1.2) — tells the broker exactly what to do next.
 * Computed live from claim + Smart Intake data; nothing here is user-editable.
 */
export function NextActionPanel({ action }: { action: NextAction }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Next action
        </h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${URGENCY_STYLES[action.urgency_level]}`}
        >
          {action.urgency_level.toUpperCase()} urgency
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold leading-snug tracking-tight">{action.next_action}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{action.broker_instruction}</p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Required documents
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {action.required_documents.map((doc, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                <CheckboxIcon />
                {doc}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Blocking issues
          </p>
          {action.blocking_issues.length === 0 ? (
            <p className="mt-2.5 flex items-center gap-2 text-sm text-emerald-300">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.004L4.29 10.2a1 1 0 1 1 1.42-1.408l3.088 3.114 6.492-6.583a1 1 0 0 1 1.414-.032Z"
                  clipRule="evenodd"
                />
              </svg>
              None — clear to proceed.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-1.5">
              {action.blocking_issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-amber-200">
                  <WarningIcon />
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
