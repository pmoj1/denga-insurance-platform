import { generateQuote } from "@/services/quoteEngine";

/**
 * Renewals Engine (Feature 3) — deterministic policy-expiry logic. Computes the
 * reminder tier for a policy and builds a broker-editable renewal draft +
 * indicative renewal quote (reusing the Quote Engine). No side effects; nothing
 * is sent without a broker approving.
 */

export type ReminderTier = "D90" | "D60" | "D30" | "DUE" | "OVERDUE";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(expiry: Date, now: Date = new Date()): number {
  return Math.round((expiry.getTime() - now.getTime()) / DAY_MS);
}

/** Reminder tier, or null when the policy is more than 90 days from expiry. */
export function reminderTier(expiry: Date, now: Date = new Date()): ReminderTier | null {
  const d = daysUntil(expiry, now);
  if (d < 0) return "OVERDUE";
  if (d === 0) return "DUE";
  if (d <= 30) return "D30";
  if (d <= 60) return "D60";
  if (d <= 90) return "D90";
  return null;
}

export const TIER_LABELS: Record<ReminderTier, string> = {
  D90: "Within 90 days",
  D60: "Within 60 days",
  D30: "Within 30 days",
  DUE: "Due today",
  OVERDUE: "Overdue",
};

export interface PolicyLike {
  policyNumber: string;
  clientName: string;
  insuranceType: string;
  assetValue: string | null;
  premium: string | null;
  expiryDate: Date;
}

/** Indicative renewal premium range, derived from the Quote Engine. */
export function renewalQuoteRange(policy: PolicyLike): string {
  const quote = generateQuote({
    insurance_type: policy.insuranceType,
    asset_value: policy.assetValue ?? undefined,
    risk_flags: [],
  });
  return quote.estimated_premium_range;
}

/** Broker-editable client renewal reminder message. */
export function buildRenewalDraft(policy: PolicyLike, now: Date = new Date()): string {
  const days = daysUntil(policy.expiryDate, now);
  const when =
    days < 0
      ? "has expired"
      : days === 0
        ? "expires today"
        : `expires in ${days} day${days === 1 ? "" : "s"}`;
  const range = renewalQuoteRange(policy);
  return [
    `Hi ${policy.clientName},`,
    "",
    `A friendly reminder that your ${policy.insuranceType} policy (${policy.policyNumber}) ${when} on ${policy.expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
    "",
    `We'd love to keep you covered. Your indicative renewal is ${range}.`,
    "",
    "Reply to this message and we'll take care of the renewal for you. These figures are indicative — the final premium is confirmed on renewal.",
  ].join("\n");
}
