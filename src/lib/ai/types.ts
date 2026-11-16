import type { CaseFileContent } from "@/lib/types";
import type { ClaimMetadata, EvidenceManifestEntry } from "@/lib/systemPrompt";

export interface EvidenceFileInput extends EvidenceManifestEntry {
  mimeType: string;
  /** File bytes for images/PDFs; omitted for audio (transcript is sent instead). */
  buffer?: Buffer;
  /** Unverified machine transcript for audio evidence. */
  transcript?: string | null;
}

export interface CaseFileGenerationRequest {
  claim: ClaimMetadata;
  evidence: EvidenceFileInput[];
}

export interface CaseFileGenerationResult {
  content: CaseFileContent;
  modelName: string;
}

/**
 * One case-file generation call, one provider. Swappable so the engine isn't
 * locked to a single vendor — see src/lib/ai/index.ts for provider selection.
 */
export interface AiProvider {
  readonly name: string;
  generateCaseFile(request: CaseFileGenerationRequest): Promise<CaseFileGenerationResult>;
}
