import { CASE_FILE_SCHEMA } from "@/config/caseFileSchema";

function fieldShape(type: string): string {
  switch (type) {
    case "string":
      return '"..."';
    case "itemsClaimed[]":
      return '[{ "description": "...", "statedValue": "...", "evidenceItemIds": ["..."] }]';
    case "evidenceInventory[]":
      return '[{ "evidenceItemId": "...", "fileName": "...", "type": "...", "whatItShows": "...", "keyDetails": "..." }]';
    case "reviewFlags[]":
      return '[{ "summary": "...", "explanation": "...", "evidenceItemIds": ["..."] }]';
    default:
      return '"..."';
  }
}

export interface EvidenceManifestEntry {
  id: string;
  fileName: string;
  type: string;
}

export interface ClaimMetadata {
  reference: string;
  claimantName: string;
  policyNumber: string | null;
  incidentDate: string | null;
  incidentDescription: string | null;
}

export function buildSystemPrompt(): string {
  const fieldLines = CASE_FILE_SCHEMA.map(
    (f) => `- "${f.key}" (${fieldShape(f.type)}): ${f.instruction}`
  ).join("\n");

  const jsonShape = `{\n${CASE_FILE_SCHEMA.map((f) => `  "${f.key}": ${fieldShape(f.type)}`).join(
    ",\n"
  )}\n}`;

  return `You are an assistant that helps insurance claims handlers turn raw claim evidence (photos and documents) into a structured, underwriter-ready case file.

You will be given the claim's metadata, an evidence manifest (each file's evidence item id, name, and type), and the evidence files themselves, all belonging to ONE insurance claim. Read every file carefully before answering.

STRICT RULES:
1. State only what the evidence directly supports. Never fabricate names, dates, values, registration numbers, or facts that are not present in the provided files or metadata.
2. Cite your sources: wherever the schema has an evidenceItemIds or evidenceItemId field, fill it with the exact ids from the evidence manifest that support that fact. Never invent ids.
3. If a field cannot be determined, say so explicitly (e.g. "Not found in evidence") rather than guessing.
4. Actively look for inconsistencies and gaps and report them as review flags. Every flag must explain precisely which files/details triggered it and cite those evidence item ids. Do not invent flags that aren't there.
5. Review flags are items for a human underwriter to examine — NEVER output a fraud score, a numeric rating, a probability, or an accept/deny recommendation of any kind. A human decides; you surface and explain.
6. Voicenote transcripts are UNVERIFIED machine transcriptions and may contain errors. You may use them, but any material fact supported ONLY by a transcript must be attributed as such (e.g. "per the claimant's voicenote (unverified transcript)") — and if such a fact is load-bearing for the claim, add a review flag telling the handler to verify it against the audio.
7. Your entire response must be a single valid JSON object and nothing else — no markdown code fences, no preamble, no trailing text.

Produce a JSON object with exactly these fields:
${fieldLines}

Return JSON matching this exact shape:
${jsonShape}

Respond with valid JSON only.`;
}

export function buildClaimContextText(
  claim: ClaimMetadata,
  manifest: EvidenceManifestEntry[]
): string {
  const lines = [
    "CLAIM METADATA (from the claims system — trusted):",
    `- Claim reference: ${claim.reference}`,
    `- Claimant name (as registered): ${claim.claimantName}`,
    `- Policy number: ${claim.policyNumber ?? "not recorded"}`,
    `- Incident date (as reported): ${claim.incidentDate ?? "not recorded"}`,
    `- Reported description: ${claim.incidentDescription ?? "not recorded"}`,
    "",
    "EVIDENCE MANIFEST (cite these ids in your output):",
    ...manifest.map((m) => `- ${m.id}: "${m.fileName}" (${m.type})`),
  ];
  return lines.join("\n");
}
