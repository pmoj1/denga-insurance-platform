import type { IntakeData } from "@/services/nextActionEngine";

/**
 * Quote Generation Engine (Step 2) — deterministic, rules-based quotes derived
 * from Smart Intake data. Produces 2–3 options, an indicative premium range,
 * assumptions, a recommendation, and a client-ready message.
 *
 * ⚠️ PRICING IS INDICATIVE PLACEHOLDER LOGIC. There is no insurer integration.
 * Real rates come from the broker/underwriter — every quote is labelled
 * "indicative" so nobody mistakes it for a bound premium (project guardrail:
 * never present fabricated rates as real).
 */

export interface QuoteOption {
  name: string;
  coverage: string;
  premiumRange: string; // e.g. "USD 45–70 / month"
  recommended: boolean;
}

export interface QuoteResult {
  client_summary: string;
  insurance_type: string;
  asset_value: string;
  risk_flags: string[];
  recommended_options: QuoteOption[];
  estimated_premium_range: string;
  assumptions: string[];
  recommendation: string;
  follow_up_required: true;
}

type Category = "motor" | "property" | "other";

interface TierConfig {
  name: string;
  coverage: string;
  // Placeholder annual premium as a % band of the sum insured.
  annualRateLow: number;
  annualRateHigh: number;
  // Fallback monthly band (USD) when no asset value is stated.
  fallbackMonthlyLow: number;
  fallbackMonthlyHigh: number;
}

// ---- PLACEHOLDER PRICING CONFIG (edit with the broker's real rates) ----
const PRICING: Record<Category, TierConfig[]> = {
  motor: [
    { name: "Third Party", coverage: "Legal minimum — third-party liability only", annualRateLow: 0.01, annualRateHigh: 0.02, fallbackMonthlyLow: 8, fallbackMonthlyHigh: 15 },
    { name: "Comprehensive", coverage: "Own damage, theft, third-party liability", annualRateLow: 0.04, annualRateHigh: 0.07, fallbackMonthlyLow: 35, fallbackMonthlyHigh: 70 },
    { name: "Comprehensive Plus", coverage: "Comprehensive + car hire, windscreen, roadside assist", annualRateLow: 0.06, annualRateHigh: 0.09, fallbackMonthlyLow: 55, fallbackMonthlyHigh: 95 },
  ],
  property: [
    { name: "Basic Cover", coverage: "Fire and specified perils on the building", annualRateLow: 0.005, annualRateHigh: 0.012, fallbackMonthlyLow: 15, fallbackMonthlyHigh: 35 },
    { name: "Standard Cover", coverage: "Building + contents, theft and break-in", annualRateLow: 0.012, annualRateHigh: 0.025, fallbackMonthlyLow: 35, fallbackMonthlyHigh: 70 },
    { name: "Premium Cover", coverage: "Building, contents, theft, accidental damage, business interruption", annualRateLow: 0.02, annualRateHigh: 0.035, fallbackMonthlyLow: 60, fallbackMonthlyHigh: 120 },
  ],
  other: [
    { name: "Basic Cover", coverage: "Core cover for the stated risk", annualRateLow: 0.01, annualRateHigh: 0.02, fallbackMonthlyLow: 20, fallbackMonthlyHigh: 45 },
    { name: "Standard Cover", coverage: "Broader cover with fewer exclusions", annualRateLow: 0.02, annualRateHigh: 0.035, fallbackMonthlyLow: 40, fallbackMonthlyHigh: 85 },
  ],
};

function categorize(insuranceType: string): Category {
  const t = insuranceType.toLowerCase();
  if (/motor|vehicle|car|truck|hilux|corolla|auto/.test(t)) return "motor";
  if (/property|home|house|shop|business|commercial|building|contents|theft|burglary/.test(t))
    return "property";
  return "other";
}

function parseAmount(assetValue: string): number | null {
  const digits = assetValue.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function round(n: number): number {
  if (n >= 100) return Math.round(n / 5) * 5;
  return Math.round(n);
}

/** Deterministic quote generation from Smart Intake data. */
export function generateQuote(intake: IntakeData): QuoteResult {
  const insuranceType = (intake.insurance_type ?? "Unspecified").trim();
  const category = categorize(insuranceType);
  const assetValueRaw = (intake.asset_value ?? "").trim();
  const amount = assetValueRaw ? parseAmount(assetValueRaw) : null;
  const riskFlags = (intake.risk_flags ?? [])
    .map((f) => f.summary?.trim())
    .filter((s): s is string => Boolean(s));
  const urgency = (intake.urgency ?? "medium").toLowerCase();

  // Risk surcharge: +6% per flag, capped at +30%.
  const riskMultiplier = 1 + Math.min(riskFlags.length * 0.06, 0.3);

  const tiers = PRICING[category];
  const options: QuoteOption[] = tiers.map((tier) => {
    let low: number;
    let high: number;
    if (amount) {
      low = round((amount * tier.annualRateLow * riskMultiplier) / 12);
      high = round((amount * tier.annualRateHigh * riskMultiplier) / 12);
    } else {
      low = round(tier.fallbackMonthlyLow * riskMultiplier);
      high = round(tier.fallbackMonthlyHigh * riskMultiplier);
    }
    return {
      name: tier.name,
      coverage: tier.coverage,
      premiumRange: `USD ${low}–${high} / month`,
      recommended: false,
    };
  });

  // Recommendation: default to the middle tier; the top tier when there are
  // multiple risk flags or high urgency; the entry tier for very low value.
  let recIndex = Math.min(1, options.length - 1);
  if (riskFlags.length >= 2 || urgency === "high") recIndex = options.length - 1;
  if (amount !== null && amount < 1000 && category === "motor") recIndex = 0;
  options[recIndex].recommended = true;
  const recommended = options[recIndex];

  const allLows = options.map((o) => Number(o.premiumRange.match(/USD (\d+)/)?.[1] ?? 0));
  const allHighs = options.map((o) => Number(o.premiumRange.match(/–(\d+)/)?.[1] ?? 0));
  const estimated_premium_range = `USD ${Math.min(...allLows)}–${Math.max(...allHighs)} / month (indicative)`;

  const location = intake.location?.trim();
  const client_summary =
    `${insuranceType} cover` +
    (assetValueRaw ? ` for an asset valued at ${assetValueRaw}` : "") +
    (location ? `, located in ${location}` : "") +
    (riskFlags.length ? `. Noted considerations: ${riskFlags.join("; ")}.` : ".");

  const assumptions = [
    "Indicative rates only — not a bound premium. Final pricing is subject to underwriting.",
    assetValueRaw
      ? `Priced against the client's stated value (${assetValueRaw}); a formal valuation may adjust this.`
      : "No asset value was stated — fallback bands used. Confirm the sum insured for accurate pricing.",
    "Assumes no adverse claims history and a standard-risk profile.",
    riskFlags.length
      ? "A risk loading has been applied for the noted considerations."
      : "No risk loadings applied.",
  ];

  const recommendation =
    `${recommended.name} (${recommended.premiumRange}) — ` +
    (riskFlags.length >= 2 || urgency === "high"
      ? "the broader cover is advisable given the risk considerations on this case."
      : recIndex === 0
        ? "the most cost-effective option that meets the legal/basic requirement."
        : "the best balance of protection and cost for this client.");

  return {
    client_summary,
    insurance_type: insuranceType,
    asset_value: assetValueRaw || "Not stated",
    risk_flags: riskFlags,
    recommended_options: options,
    estimated_premium_range,
    assumptions,
    recommendation,
    follow_up_required: true,
  };
}

/** Build the WhatsApp/email-ready client message from a generated quote. */
export function buildClientMessage(quote: QuoteResult, claimantName: string): string {
  const greeting = claimantName ? `Hi ${claimantName},` : "Hello,";
  const lines = [
    greeting,
    "",
    `Thank you for your enquiry. Based on the details you shared (${quote.client_summary.replace(/\.$/, "")}), here are your indicative options:`,
    "",
    ...quote.recommended_options.map(
      (o) => `• ${o.name}${o.recommended ? " ⭐ (recommended)" : ""} — ${o.coverage}. Est. ${o.premiumRange}.`
    ),
    "",
    `Our recommendation: ${quote.recommendation}`,
    "",
    "Please note these are indicative estimates, not final prices — the exact premium is confirmed once we complete underwriting.",
    "",
    "Would you like us to proceed with a formal quote on the recommended option? Just reply to this message and we'll take it from there.",
  ];
  return lines.join("\n");
}
