import type { ClaimStatus } from "@/generated/prisma/enums";

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  INTAKE_RECEIVED: "Intake received",
  DOCUMENTS_PENDING: "Documents pending",
  SUBMITTED_TO_INSURER: "Submitted to insurer",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const STATUS_STYLES: Record<ClaimStatus, string> = {
  INTAKE_RECEIVED: "bg-blue-50 text-blue-700 border-blue-200",
  DOCUMENTS_PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  SUBMITTED_TO_INSURER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  UNDER_REVIEW: "bg-purple-50 text-purple-700 border-purple-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

// The linear "happy path" of the lifecycle, used to render the stage stepper.
// REJECTED is a terminal off-path state shown only when a claim reaches it.
export const STATUS_FLOW: ClaimStatus[] = [
  "INTAKE_RECEIVED",
  "DOCUMENTS_PENDING",
  "SUBMITTED_TO_INSURER",
  "UNDER_REVIEW",
  "APPROVED",
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
