import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildClaimContextText } from "@/lib/systemPrompt";
import { extractJson } from "./extractJson";
import type { AiProvider, CaseFileGenerationRequest, CaseFileGenerationResult } from "./types";
import type { CaseFileContent } from "@/lib/types";

const MODEL = "claude-sonnet-5";

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export class AnthropicProvider implements AiProvider {
  readonly name = MODEL;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateCaseFile(request: CaseFileGenerationRequest): Promise<CaseFileGenerationResult> {
    const contentBlocks: ContentBlock[] = [
      {
        type: "text",
        text: buildClaimContextText(request.claim, request.evidence),
      },
    ];

    for (const item of request.evidence) {
      if (item.transcript != null) {
        contentBlocks.push({
          type: "text",
          text: `Evidence item ${item.id} — voicenote "${item.fileName}" (UNVERIFIED machine transcript):\n${item.transcript}`,
        });
        continue;
      }
      if (!item.buffer) continue;
      const base64 = item.buffer.toString("base64");
      contentBlocks.push({ type: "text", text: `Evidence item ${item.id} — file "${item.fileName}":` });
      if (IMAGE_MEDIA_TYPES.includes(item.mimeType as ImageMediaType)) {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: item.mimeType as ImageMediaType, data: base64 },
        });
      } else {
        contentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        });
      }
    }

    contentBlocks.push({
      type: "text",
      text: "Above is all the evidence for this one claim. Produce the case file JSON now, following the schema and rules in the system prompt exactly.",
    });

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: contentBlocks }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("The model did not return a text response.");
    }

    const content = extractJson(textBlock.text) as CaseFileContent;
    return { content, modelName: MODEL };
  }
}
