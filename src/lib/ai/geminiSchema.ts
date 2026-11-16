import { Type, type Schema } from "@google/genai";
import { CASE_FILE_SCHEMA } from "@/config/caseFileSchema";

const ITEMS_CLAIMED_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      description: { type: Type.STRING },
      statedValue: { type: Type.STRING },
      evidenceItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["description"],
  },
};

const EVIDENCE_INVENTORY_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      evidenceItemId: { type: Type.STRING },
      fileName: { type: Type.STRING },
      type: { type: Type.STRING },
      whatItShows: { type: Type.STRING },
      keyDetails: { type: Type.STRING },
    },
    required: ["evidenceItemId", "fileName", "type", "whatItShows", "keyDetails"],
  },
};

const REVIEW_FLAGS_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      explanation: { type: Type.STRING },
      evidenceItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["summary", "explanation", "evidenceItemIds"],
  },
};

function schemaForFieldType(type: string): Schema {
  switch (type) {
    case "itemsClaimed[]":
      return ITEMS_CLAIMED_SCHEMA;
    case "evidenceInventory[]":
      return EVIDENCE_INVENTORY_SCHEMA;
    case "reviewFlags[]":
      return REVIEW_FLAGS_SCHEMA;
    default:
      return { type: Type.STRING };
  }
}

/** Structured-output schema derived from CASE_FILE_SCHEMA — stays in sync automatically. */
export function buildGeminiResponseSchema(): Schema {
  const properties: Record<string, Schema> = {};
  for (const field of CASE_FILE_SCHEMA) {
    properties[field.key] = schemaForFieldType(field.type);
  }
  return {
    type: Type.OBJECT,
    properties,
    required: CASE_FILE_SCHEMA.map((f) => f.key),
  };
}
