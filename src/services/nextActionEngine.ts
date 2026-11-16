import type { ClaimStatus } from "@/generated/prisma/enums";

/**
 * Next Action Engine (Step 1.2) — a deterministic, computed layer on top of a
 * claim. It never writes to or overwrites claim data; it reads existing claim
 * fields + Smart Intake output and derives "what the broker should do next".
 *
 * Deterministic-first: this file has no AI dependency and no side effects.
 * An optional AI refinement lives in src/agents/nextActionAgent.ts.
 */

export type UrgencyLevel = "low" | "medium" | "high";

export interface NextAction {
  next_action: string;
  required_documents: string[];
  broker_instruction: string;
  urgency_level: UrgencyLevel;
  blocking_issues: string[];
}

/** Shape of the persisted Smart Intake blob (all fields optional/defensive). */
export interface IntakeData {
  insurance_type?: string;
  asset_value?: string;
  location?: string;
  urgency?: string;
  action_required?: string;
  risk_flags?: { summary?: string; explanation?: string }[];
  follow_up_required?: boolean;
  follow_up_questions?: string[];
}

/** Everything the engine needs, derived from a claim + its relations. */
export interface ClaimSignals {
  status: ClaimStatus;
  hasPolicyNumber: boolean;
  hasIncidentDate: boolean;
  imageCount: number;
  pdfCount: number;
  audioCount: number;
  untranscribedAudioCount: number;
  hasCaseFile: boolean;
  intake: IntakeData | null;
}

type InsuranceCategory = "motor" | "property" | "other";

function categorize(insuranceType: string | undefined): InsuranceCategory {
  const t = (insuranceType ?? "").toLowerCase();
  if (/motor|vehicle|car|truck|hilux|corolla|auto/.test(t)) return "motor";
  if (/property|home|house|shop|business|commercial|building|contents|theft|burglary/.test(t))
    return "property";
  return "other";
}

const REQUIRED_DOCS: Record<InsuranceCategory, string[]> = {
  motor: [
    "Police / accident report",
    "Photos of the damage",
    "Driver's licence",
    "Vehicle registration book",
    "Repair quotation",
  ],
  property: [
    "Police report (for theft/break-in)",
    "Photos of the damage or loss",
    "Proof of ownership",
    "Inventory or valuation of affected items",
    "Purchase receipts where available",
  ],
  other: [
    "Police or incident report",
    "Photos or supporting evidence",
    "Proof of ownership / insurable interest",
    "Relevant receipts or valuations",
  ],
};

function computeBlockingIssues(s: ClaimSignals): string[] {
  const issues: string[] = [];
  const noEvidence = s.imageCount + s.pdfCount + s.audioCount === 0;

  if (noEvidence) issues.push("No evidence uploaded yet");
  if (!noEvidence && s.imageCount === 0) issues.push("No damage/loss photos on file");
  if (!s.hasPolicyNumber) issues.push("Policy number not captured");
  if (!s.hasIncidentDate) issues.push("Incident date not confirmed");
  if (s.untranscribedAudioCount > 0)
    issues.push(`${s.untranscribedAudioCount} voicenote(s) awaiting transcription`);

  const questions = s.intake?.follow_up_questions ?? [];
  if ((s.intake?.follow_up_required ?? false) && questions.length > 0)
    issues.push(`${questions.length} outstanding question(s) for the client`);

  return issues;
}

function computeUrgency(s: ClaimSignals, blockingCount: number): UrgencyLevel {
  if (s.status === "APPROVED") return "low";
  if (s.status === "REJECTED") return "medium";

  const intakeUrgency = (s.intake?.urgency ?? "").toLowerCase();
  let score = intakeUrgency === "high" ? 3 : intakeUrgency === "medium" ? 2 : 1;

  const riskFlags = s.intake?.risk_flags?.length ?? 0;
  if (riskFlags >= 2) score += 2;
  else if (riskFlags === 1) score += 1;

  if (blockingCount >= 2) score += 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function primaryNextAction(s: ClaimSignals, blocking: string[]): string {
  const noEvidence = s.imageCount + s.pdfCount + s.audioCount === 0;
  if (noEvidence) return "Request evidence from the client (photos + supporting documents)";
  if (s.untranscribedAudioCount > 0) return "Transcribe the client's voicenote(s), then review";

  switch (s.status) {
    case "INTAKE_RECEIVED":
      if (blocking.length > 0) return "Collect the outstanding items, then generate the case file";
      return "Generate the case file and prepare to submit to the insurer";
    case "DOCUMENTS_PENDING":
      return "Follow up with the client for the outstanding documents";
    case "SUBMITTED_TO_INSURER":
      return "Await the insurer's response; follow up if there is no reply within 48 hours";
    case "UNDER_REVIEW":
      return "Monitor the insurer's review and supply any clarifications they request";
    case "APPROVED":
      return "Notify the client of approval and arrange the settlement";
    case "REJECTED":
      return "Review the rejection reason and advise the client on their options";
    default:
      return "Review the claim and decide the next step";
  }
}

function brokerInstruction(s: ClaimSignals, action: string, blocking: string[]): string {
  const parts = [action + "."];
  if (blocking.length > 0) {
    parts.push(`Before this can progress, resolve: ${blocking.join("; ")}.`);
  }
  const questions = s.intake?.follow_up_questions ?? [];
  if (questions.length > 0) {
    parts.push(`Ask the client: ${questions.slice(0, 3).join(" ")}`);
  }
  return parts.join(" ");
}

/** Pure, deterministic computation of the claim's Next Action. */
export function computeNextAction(signals: ClaimSignals): NextAction {
  const category = categorize(signals.intake?.insurance_type);
  const blocking_issues = computeBlockingIssues(signals);
  const next_action = primaryNextAction(signals, blocking_issues);
  const urgency_level = computeUrgency(signals, blocking_issues.length);
  const broker_instruction = brokerInstruction(signals, next_action, blocking_issues);

  return {
    next_action,
    required_documents: REQUIRED_DOCS[category],
    broker_instruction,
    urgency_level,
    blocking_issues,
  };
}
