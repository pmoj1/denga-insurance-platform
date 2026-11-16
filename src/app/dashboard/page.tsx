import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeNextAction, type IntakeData, type NextAction } from "@/services/nextActionEngine";
import { STATUS_LABELS, STATUS_STYLES, formatDate } from "@/lib/format";
import type { ClaimStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

interface DashClaim {
  id: string;
  reference: string;
  status: ClaimStatus;
  updatedAt: Date;
  createdByName: string;
  nextAction: NextAction;
  openDocRequests: number;
}

/* ---------- presentational helpers (no business logic) ---------- */

const KPI_ICONS = {
  urgent: (
    <path
      fillRule="evenodd"
      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      clipRule="evenodd"
    />
  ),
  docs: (
    <path
      fillRule="evenodd"
      d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"
      clipRule="evenodd"
    />
  ),
  send: (
    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
  ),
  open: (
    <path
      fillRule="evenodd"
      d="M2 4.75C2 3.784 2.784 3 3.75 3h4.836c.464 0 .909.184 1.237.513l1.414 1.414a.25.25 0 0 0 .177.073h4.836c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 16.25 17H3.75A1.75 1.75 0 0 1 2 15.25V4.75Z"
      clipRule="evenodd"
    />
  ),
} as const;

function KpiIcon({ name, className }: { name: keyof typeof KPI_ICONS; className: string }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${className}`}>
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
        {KPI_ICONS[name]}
      </svg>
    </span>
  );
}

function Widget({
  title,
  count,
  accent,
  icon,
  children,
}: {
  title: string;
  count?: number;
  accent?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        </div>
        {count !== undefined && (
          <span className={`text-xl font-semibold tabular-nums ${accent ?? "text-slate-900"}`}>{count}</span>
        )}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1.5 text-sm text-slate-400">{children}</p>;
}

function ClaimRow({ id, reference, status, extra }: { id: string; reference: string; status: ClaimStatus; extra?: string }) {
  return (
    <Link
      href={`/claims/${id}`}
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
    >
      <span className="font-medium text-slate-800">{reference}</span>
      <span className="flex items-center gap-2">
        {extra && <span className="text-xs text-slate-400">{extra}</span>}
        <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </span>
    </Link>
  );
}

// Maps the task tone (text colour class) to its priority dot colour.
const TASK_DOTS: Record<string, string> = {
  "text-red-600": "bg-red-500",
  "text-amber-600": "bg-amber-500",
  "text-slate-600": "bg-slate-300",
};

/* ---------- data (unchanged) ---------- */

const OPEN_STATUSES: ClaimStatus[] = [
  "INTAKE_RECEIVED",
  "DOCUMENTS_PENDING",
  "SUBMITTED_TO_INSURER",
  "UNDER_REVIEW",
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const tenantId = session.user.tenantId;

  const renewalHorizon = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000);
  const [claimsRaw, quotes, activity, team, upcomingPolicies] = await Promise.all([
    db.claim.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { name: true, id: true } },
        evidenceItems: { select: { type: true, transcript: true } },
        clientRequests: { select: { type: true, respondedAt: true } },
        _count: { select: { caseFiles: true } },
      },
    }),
    db.quote.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { claim: { select: { id: true, reference: true } } },
    }),
    db.auditLogEntry.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.user.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.policy.findMany({
      where: { tenantId, status: "ACTIVE", expiryDate: { lte: renewalHorizon } },
      orderBy: { expiryDate: "asc" },
      take: 5,
      select: { id: true, policyNumber: true, clientName: true, expiryDate: true },
    }),
  ]);

  const claims: DashClaim[] = claimsRaw.map((c) => {
    const openDocRequests = c.clientRequests.filter((r) => r.type === "DOCUMENT" && !r.respondedAt).length;
    const nextAction = computeNextAction({
      status: c.status,
      hasPolicyNumber: Boolean(c.policyNumber),
      hasIncidentDate: Boolean(c.incidentDate),
      imageCount: c.evidenceItems.filter((e) => e.type === "IMAGE").length,
      pdfCount: c.evidenceItems.filter((e) => e.type === "PDF").length,
      audioCount: c.evidenceItems.filter((e) => e.type === "AUDIO").length,
      untranscribedAudioCount: c.evidenceItems.filter((e) => e.type === "AUDIO" && !e.transcript).length,
      hasCaseFile: c._count.caseFiles > 0,
      intake: (c.intake as IntakeData | null) ?? null,
    });
    return {
      id: c.id,
      reference: c.reference,
      status: c.status,
      updatedAt: c.updatedAt,
      createdByName: c.createdBy.name,
      nextAction,
      openDocRequests,
    };
  });

  const open = claims.filter((c) => OPEN_STATUSES.includes(c.status));
  const urgent = open.filter((c) => c.nextAction.urgency_level === "high");
  const waitingDocs = open.filter((c) => c.status === "DOCUMENTS_PENDING" || c.openDocRequests > 0);
  const waitingSubmission = claims.filter((c) => c.status === "INTAKE_RECEIVED");

  const now = Date.now();
  const quotesAwaitingApproval = quotes.filter((q) => !q.sentAt);
  const quotesAwaitingFollowUp = quotes.filter(
    (q) => q.sentAt && q.followUpRequired && !q.clientResponse
  );

  // Today's tasks — a prioritised, synthesised action list.
  const tasks: { label: string; ref: string; id: string; tone: string }[] = [
    ...urgent.map((c) => ({ label: c.nextAction.next_action, ref: c.reference, id: c.id, tone: "text-red-600" })),
    ...quotesAwaitingFollowUp.map((q) => ({
      label: `Follow up on the quote sent to ${q.claim.reference}`,
      ref: q.claim.reference,
      id: q.claim.id,
      tone: "text-amber-600",
    })),
    ...waitingDocs
      .filter((c) => c.nextAction.urgency_level !== "high")
      .map((c) => ({ label: "Chase outstanding documents", ref: c.reference, id: c.id, tone: "text-slate-600" })),
  ].slice(0, 8);

  const workload = team
    .map((u) => ({ name: u.name, count: open.filter((c) => claimsRaw.find((r) => r.id === c.id)?.createdBy.id === u.id).length }))
    .filter((w) => w.count > 0)
    .sort((a, b) => b.count - a.count);

  /* ---------- presentation ---------- */

  const maxWorkload = workload[0]?.count ?? 1;
  const dayMs = 24 * 60 * 60 * 1000;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Your book at a glance · {formatDate(new Date())}</p>
        </div>
        <Link
          href="/claims/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          New claim
        </Link>
      </div>

      {/* Headline counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Widget
          title="Urgent claims"
          count={urgent.length}
          accent="text-red-600"
          icon={<KpiIcon name="urgent" className="bg-red-50 text-red-600" />}
        >
          <div className="space-y-0.5">
            {urgent.length === 0 ? (
              <EmptyNote>Nothing urgent — nice.</EmptyNote>
            ) : (
              urgent.slice(0, 4).map((c) => <ClaimRow key={c.id} {...c} />)
            )}
          </div>
        </Widget>
        <Widget
          title="Waiting for documents"
          count={waitingDocs.length}
          accent="text-amber-600"
          icon={<KpiIcon name="docs" className="bg-amber-50 text-amber-600" />}
        >
          <div className="space-y-0.5">
            {waitingDocs.slice(0, 4).map((c) => (
              <ClaimRow key={c.id} {...c} extra={c.openDocRequests ? `${c.openDocRequests} req` : undefined} />
            ))}
            {waitingDocs.length === 0 && <EmptyNote>None.</EmptyNote>}
          </div>
        </Widget>
        <Widget
          title="Waiting for submission"
          count={waitingSubmission.length}
          accent="text-blue-600"
          icon={<KpiIcon name="send" className="bg-blue-50 text-blue-600" />}
        >
          <div className="space-y-0.5">
            {waitingSubmission.slice(0, 4).map((c) => (
              <ClaimRow key={c.id} {...c} />
            ))}
            {waitingSubmission.length === 0 && <EmptyNote>None.</EmptyNote>}
          </div>
        </Widget>
        <Widget
          title="Open claims"
          count={open.length}
          icon={<KpiIcon name="open" className="bg-slate-100 text-slate-600" />}
        >
          <EmptyNote>Across {workload.length || 0} team member(s).</EmptyNote>
        </Widget>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Today's tasks */}
        <div className="lg:col-span-2">
          <Widget title="Today's tasks" count={tasks.length}>
            {tasks.length === 0 ? (
              <EmptyNote>You&apos;re all caught up.</EmptyNote>
            ) : (
              <ul className="space-y-0.5">
                {tasks.map((t, i) => (
                  <li key={i}>
                    <Link
                      href={`/claims/${t.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${TASK_DOTS[t.tone] ?? "bg-slate-300"}`} />
                        <span className={`min-w-0 truncate ${t.tone}`}>{t.label}</span>
                      </span>
                      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t.ref}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Widget title="Quotes awaiting approval" count={quotesAwaitingApproval.length} accent="text-blue-600">
              <div className="space-y-0.5">
                {quotesAwaitingApproval.slice(0, 4).map((q) => (
                  <Link
                    key={q.id}
                    href={`/claims/${q.claim.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
                  >
                    <span className="font-medium text-slate-800">{q.claim.reference}</span>
                    <span className="text-xs text-slate-400">{q.estimatedPremiumRange}</span>
                  </Link>
                ))}
                {quotesAwaitingApproval.length === 0 && <EmptyNote>None.</EmptyNote>}
              </div>
            </Widget>
            <Widget title="Quotes awaiting follow-up" count={quotesAwaitingFollowUp.length} accent="text-amber-600">
              <div className="space-y-0.5">
                {quotesAwaitingFollowUp.slice(0, 4).map((q) => {
                  const isOverdue = Boolean(q.followUpDueAt && q.followUpDueAt.getTime() < now);
                  return (
                    <Link
                      key={q.id}
                      href={`/claims/${q.claim.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
                    >
                      <span className="font-medium text-slate-800">{q.claim.reference}</span>
                      <span className={`text-xs ${isOverdue ? "font-medium text-red-600" : "text-slate-400"}`}>
                        due {q.followUpDueAt ? formatDate(q.followUpDueAt) : "—"}
                        {isOverdue ? " · overdue" : ""}
                      </span>
                    </Link>
                  );
                })}
                {quotesAwaitingFollowUp.length === 0 && <EmptyNote>None.</EmptyNote>}
              </div>
            </Widget>
          </div>

          <div className="mt-4">
            <Widget title="Recently updated claims">
              <div className="space-y-0.5">
                {claims.slice(0, 6).map((c) => (
                  <ClaimRow key={c.id} {...c} extra={formatDate(c.updatedAt)} />
                ))}
              </div>
            </Widget>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Widget title="Upcoming renewals" count={upcomingPolicies.length} accent="text-blue-600">
            {upcomingPolicies.length === 0 ? (
              <EmptyNote>Nothing due in the next 90 days.</EmptyNote>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {upcomingPolicies.map((p) => {
                  const daysLeft = Math.ceil((p.expiryDate.getTime() - now) / dayMs);
                  const chip =
                    daysLeft <= 30
                      ? "bg-amber-50 text-amber-700"
                      : daysLeft <= 60
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-600";
                  return (
                    <li key={p.id}>
                      <Link
                        href="/renewals"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">{p.policyNumber}</span>
                          <span className="block truncate text-xs text-slate-400">{p.clientName}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${chip}`}>
                          {daysLeft >= 0 ? `${daysLeft}d` : "overdue"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>

          <Widget title="Team workload">
            {workload.length === 0 ? (
              <EmptyNote>No open claims assigned.</EmptyNote>
            ) : (
              <ul className="space-y-2.5 px-2 py-1.5 text-sm">
                {workload.map((w) => (
                  <li key={w.name}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">{w.name}</span>
                      <span className="font-medium tabular-nums text-slate-900">{w.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-sky-500/80"
                        style={{ width: `${Math.round((w.count / maxWorkload) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          <Widget title="Activity">
            {activity.length === 0 ? (
              <EmptyNote>No recent activity.</EmptyNote>
            ) : (
              <ul className="space-y-2 px-2 py-1.5 text-xs">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                    <span className="text-slate-500">
                      <span className="font-medium text-slate-700">{a.action.replace(/[._]/g, " ")}</span>
                      {" · "}
                      {formatDate(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          <Widget title="Quick actions">
            <div className="flex flex-col gap-2 px-2 py-1.5 text-sm">
              <Link
                href="/claims/new"
                className="rounded-lg bg-slate-900 px-3 py-2 text-center font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                New claim
              </Link>
              <Link
                href="/claims"
                className="rounded-lg border border-slate-300 px-3 py-2 text-center font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
              >
                All claims
              </Link>
              <Link
                href="/renewals"
                className="rounded-lg border border-slate-300 px-3 py-2 text-center font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
              >
                Renewals queue
              </Link>
            </div>
          </Widget>
        </div>
      </div>
    </main>
  );
}
