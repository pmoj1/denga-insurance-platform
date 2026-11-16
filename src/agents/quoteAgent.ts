import type { QuoteResult } from "@/services/quoteEngine";

/**
 * Optional AI helper for the Quote Engine (Step 2).
 *
 * The deterministic engine in src/services/quoteEngine.ts is the source of
 * truth. This agent is an OPTIONAL refinement (enabled with QUOTE_AGENT=on)
 * that can only rephrase the client-facing MESSAGE into warmer, more localised
 * language — it never changes options, prices, or the recommendation, so it
 * cannot alter the quote's substance.
 */
export function isQuoteAgentEnabled(): boolean {
  return process.env.QUOTE_AGENT === "on";
}

export async function refineClientMessage(
  message: string,
  _quote: QuoteResult
): Promise<string> {
  void _quote;
  if (!isQuoteAgentEnabled()) return message;
  // Seam for an optional LLM rephrase via the existing providers. Left as a
  // deterministic pass-through by default to avoid per-quote latency/cost.
  return message;
}
