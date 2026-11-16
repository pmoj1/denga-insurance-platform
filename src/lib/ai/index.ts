import { AnthropicProvider } from "./anthropicProvider";
import { GeminiProvider } from "./geminiProvider";
import type { AiProvider } from "./types";

export type { AiProvider, CaseFileGenerationRequest, CaseFileGenerationResult } from "./types";

/**
 * Prefers Anthropic when configured (the primary engine this app was designed
 * around); falls back to Gemini's free tier otherwise. Note: Gemini's free
 * tier may use submitted data to improve Google's models — fine for testing,
 * not for real claim data. Switch back by adding ANTHROPIC_API_KEY.
 */
export function getAiProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  }
  if (process.env.GEMINI_API_KEY) {
    return new GeminiProvider(process.env.GEMINI_API_KEY);
  }
  throw new Error(
    "No AI provider configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in your environment and restart."
  );
}
