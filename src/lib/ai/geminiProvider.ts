import { GoogleGenAI, type Part } from "@google/genai";
import { buildSystemPrompt, buildClaimContextText } from "@/lib/systemPrompt";
import { buildGeminiResponseSchema } from "./geminiSchema";
import { extractJson } from "./extractJson";
import type { AiProvider, CaseFileGenerationRequest, CaseFileGenerationResult } from "./types";
import type { CaseFileContent } from "@/lib/types";

const MODEL = "gemini-2.5-flash";

export class GeminiProvider implements AiProvider {
  readonly name = MODEL;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateCaseFile(request: CaseFileGenerationRequest): Promise<CaseFileGenerationResult> {
    const parts: Part[] = [{ text: buildClaimContextText(request.claim, request.evidence) }];

    for (const item of request.evidence) {
      if (item.transcript != null) {
        parts.push({
          text: `Evidence item ${item.id} — voicenote "${item.fileName}" (UNVERIFIED machine transcript):\n${item.transcript}`,
        });
        continue;
      }
      if (!item.buffer) continue;
      parts.push({ text: `Evidence item ${item.id} — file "${item.fileName}":` });
      parts.push({ inlineData: { mimeType: item.mimeType, data: item.buffer.toString("base64") } });
    }

    parts.push({
      text: "Above is all the evidence for this one claim. Produce the case file JSON now, following the schema and rules in the system prompt exactly.",
    });

    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: parts,
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: "application/json",
        responseSchema: buildGeminiResponseSchema(),
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("The model did not return a text response.");
    }

    const content = extractJson(text) as CaseFileContent;
    return { content, modelName: MODEL };
  }
}
