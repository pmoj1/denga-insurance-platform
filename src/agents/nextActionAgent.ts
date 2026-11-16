import type { NextAction, ClaimSignals } from "@/services/nextActionEngine";

/**
 * Optional AI helper for the Next Action Engine (Step 1.2).
 *
 * The deterministic engine in src/services/nextActionEngine.ts is the source of
 * truth and always runs. This agent is an OPTIONAL refinement that only runs
 * when NEXT_ACTION_AGENT=on — it rewrites `broker_instruction` into warmer,
 * plainer language via the existing AI providers. It can only soften wording;
 * it can never change next_action, urgency_level, required_documents, or
 * blocking_issues, so it cannot corrupt the deterministic result.
 */
export function isNextActionAgentEnabled(): boolean {
  return process.env.NEXT_ACTION_AGENT === "on";
}

export async function refineBrokerInstruction(
  action: NextAction,
  _signals: ClaimSignals
): Promise<NextAction> {
  void _signals;
  if (!isNextActionAgentEnabled()) return action;

  // Deliberately kept as a no-op-by-default seam: wiring an LLM call here would
  // add latency + cost to every claim view. Enable and implement only if the
  // deterministic phrasing proves insufficient in the field.
  return action;
}
