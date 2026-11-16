"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_STYLES, formatDate } from "@/lib/format";
import type { ClaimStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";

export interface ClaimListRow {
  id: string;
  reference: string;
  claimantName: string;
  policyNumber: string | null;
  incidentDate: string | null;
  evidenceCount: number;
  hasCaseFile: boolean;
  status: ClaimStatus;
}

type SortKey = "reference" | "claimantName" | "incidentDate" | "evidenceCount" | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: "reference", label: "Reference" },
  { key: "claimantName", label: "Claimant" },
  { key: null, label: "Policy" },
  { key: "incidentDate", label: "Incident date" },
  { key: "evidenceCount", label: "Evidence" },
  { key: null, label: "Case file" },
  { key: "status", label: "Status" },
];

function compareRows(a: ClaimListRow, b: ClaimListRow, key: SortKey): number {
  switch (key) {
    case "evidenceCount":
      return a.evidenceCount - b.evidenceCount;
    case "incidentDate": {
      // Missing dates sort last regardless of direction being applied after.
      if (!a.incidentDate && !b.incidentDate) return 0;
      if (!a.incidentDate) return 1;
      if (!b.incidentDate) return -1;
      return a.incidentDate.localeCompare(b.incidentDate);
    }
    case "status":
      return STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status]);
    default:
      return a[key].localeCompare(b[key]);
  }
}

function SortIcon({ dir }: { dir: SortDir | null }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3 w-3">
      {dir === "asc" ? (
        <path d="M10 5l5 7H5l5-7z" />
      ) : dir === "desc" ? (
        <path d="M10 15l-5-7h10l-5 7z" />
      ) : (
        <path d="M10 4l4 5H6l4-5zm0 12l-4-5h8l-4 5z" fillOpacity="0.35" />
      )}
    </svg>
  );
}

export function ClaimsTable({ rows }: { rows: ClaimListRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClaimStatus>("ALL");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = rows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.reference.toLowerCase().includes(q) ||
        r.claimantName.toLowerCase().includes(q) ||
        (r.policyNumber ?? "").toLowerCase().includes(q)
      );
    });
    if (!sortKey) return matched;
    const sorted = [...matched].sort((a, b) => compareRows(a, b, sortKey));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [rows, query, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
    setPage(0);
  };

  const hasFilters = query.trim() !== "" || statusFilter !== "ALL";

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No claims yet"
        description="Create the first claim to start building a case file."
        action={<ButtonLink href="/claims/new">New claim</ButtonLink>}
      />
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="claims-search" className="sr-only">
            Search claims
          </label>
          <Input
            id="claims-search"
            type="search"
            placeholder="Search reference, claimant, policy…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="claims-status" className="sr-only">
            Filter by status
          </label>
          <Select
            id="claims-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "ALL" | ClaimStatus);
              setPage(0);
            }}
          >
            <option value="ALL">All statuses</option>
            {(Object.keys(STATUS_LABELS) as ClaimStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <p className="ml-auto text-sm tabular-nums text-slate-500">
          {filtered.length} of {rows.length} claims
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No claims match your filters"
          description="Try a different search term or status."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setStatusFilter("ALL");
                setPage(0);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.label}
                        scope="col"
                        aria-sort={
                          col.key && sortKey === col.key
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {col.key ? (
                          <button
                            onClick={() => toggleSort(col.key as SortKey)}
                            className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wide transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 rounded"
                          >
                            {col.label}
                            <SortIcon dir={sortKey === col.key ? sortDir : null} />
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((claim) => (
                    <tr key={claim.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/claims/${claim.id}`}
                          className="font-medium text-slate-900 transition hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 rounded"
                        >
                          {claim.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{claim.claimantName}</td>
                      <td className="px-4 py-3 text-slate-500">{claim.policyNumber ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {formatDate(claim.incidentDate)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {claim.evidenceCount} files
                      </td>
                      <td className="px-4 py-3">
                        {claim.hasCaseFile ? (
                          <Badge tone="success">Generated</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_STYLES[claim.status]}>
                          {STATUS_LABELS[claim.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {pageRows.map((claim) => (
              <li key={claim.id}>
                <Link
                  href={`/claims/${claim.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{claim.reference}</span>
                    <Badge className={STATUS_STYLES[claim.status]}>
                      {STATUS_LABELS[claim.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{claim.claimantName}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {claim.policyNumber ?? "No policy"} · {formatDate(claim.incidentDate)} ·{" "}
                    {claim.evidenceCount} files
                    {claim.hasCaseFile ? " · Case file ready" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm tabular-nums text-slate-500">
                Showing {rangeStart}–{rangeEnd} of {filtered.length}
                {hasFilters ? " (filtered)" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
