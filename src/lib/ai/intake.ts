import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { extractJson } from "./extractJson";

/**
 * Smart intake: turn a client's raw message (WhatsApp text, email body, or a
 * voicenote transcript) into structured triage data + prefill for the claim
 * form. Guardrail: risk_flags are explained observations for a human — never
 * scores, never accept/deny signals.
 */
export interface IntakeRiskFlag {
  summary: string;
  explanation: string;
}

export interface IntakeExtraction {
  insurance_type: string; // motor | property | other | unknown
  asset_value: string; // as stated by the client, "" if not mentioned
  location: string;
  urgency: "low" | "medium" | "high";
  action_required: string;
  risk_flags: IntakeRiskFlag[];
  follow_up_required: boolean;
  follow_up_questions: string[];
  prefill: {
    claimant_name: string;
    policy_number: string;
    incident_date: string; // YYYY-MM-DD or ""
    incident_description: string;
  };
}

const INTAKE_PROMPT = `You are the intake assistant for an insurance brokerage in Zimbabwe. You are given ONE raw message from a client — a WhatsApp text, an email body, or the transcript of a voicenote. Extract structured intake data from it.

STRICT RULES:
1. Extract only what the message states. Never invent names, dates, values, or locations. Use "" (or "unknown" for insurance_type) when something is not stated.
2. asset_value is the value AS STATED by the client, verbatim (e.g. "USD 3,000"). Never estimate.
3. urgency is one of "low", "medium", "high" — judge from stated facts (injuries, ongoing damage, third parties involved, time pressure), not speculation.
4. action_required is one short sentence: the next concrete step for the broker.
5. risk_flags: things a human should look into, each with a one-line summary and an explanation quoting the exact wording that triggered it. NEVER output a score, rating, or accept/deny signal. Empty array if nothing stands out.
6. follow_up_required + follow_up_questions: whether the broker needs more information before proceeding, and the specific questions to ask the client.
7. prefill.incident_date must be YYYY-MM-DD if a date can be determined from the message, otherwise "".
8. prefill.incident_description is a clean 1-3 sentence restatement of what happened, using only stated facts.
9. Respond with a single valid JSON object and nothing else.`;

const GEMINI_INTAKE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    insurance_type: { type: Type.STRING },
    asset_value: { type: Type.STRING },
    location: { type: Type.STRING },
    urgency: { type: Type.STRING, enum: ["low", "medium", "high"] },
    action_required: { type: Type.STRING },
    risk_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["summary", "explanation"],
      },
    },
    follow_up_required: { type: Type.BOOLEAN },
    follow_up_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    prefill: {
      type: Type.OBJECT,
      properties: {
        claimant_name: { type: Type.STRING },
        policy_number: { type: Type.STRING },
        incident_date: { type: Type.STRING },
        incident_description: { type: Type.STRING },
      },
      required: ["claimant_name", "policy_number", "incident_date", "incident_description"],
    },
  },
  required: [
    "insurance_type",
    "asset_value",
    "location",
    "urgency",
    "action_required",
    "risk_flags",
    "follow_up_required",
    "follow_up_questions",
    "prefill",
  ],
};

export async function analyzeIntake(message: string): Promise<IntakeExtraction> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Message is empty.");

  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: INTAKE_PROMPT,
      messages: [{ role: "user", content: `CLIENT MESSAGE:\n${trimmed}` }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No response from the model.");
    return normalize(extractJson(textBlock.text));
  }

  if (process.env.GEMINI_API_KEY) {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: `CLIENT MESSAGE:\n${trimmed}` }],
      config: {
        systemInstruction: INTAKE_PROMPT,
        responseMimeType: "application/json",
        responseSchema: GEMINI_INTAKE_SCHEMA,
      },
    });
    if (!response.text) throw new Error("No response from the model.");
    return normalize(extractJson(response.text));
  }

  throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.");
}

/** Defensive cleanup so malformed model output can never reach the DB or UI. */
function normalize(raw: unknown): IntakeExtraction {
  const o = (raw ?? {}) as Record<string, unknown>;
  const p = (o.prefill ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const urgency = ["low", "medium", "high"].includes(o.urgency as string)
    ? (o.urgency as "low" | "medium" | "high")
    : "medium";
  const flags = Array.isArray(o.risk_flags)
    ? o.risk_flags
        .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
        .map((f) => ({ summary: str(f.summary, 200), explanation: str(f.explanation, 600) }))
        .filter((f) => f.summary)
        .slice(0, 10)
    : [];
  const questions = Array.isArray(o.follow_up_questions)
    ? o.follow_up_questions.filter((q): q is string => typeof q === "string").map((q) => q.slice(0, 300)).slice(0, 8)
    : [];
  return {
    insurance_type: str(o.insurance_type, 60) || "unknown",
    asset_value: str(o.asset_value, 100),
    location: str(o.location, 200),
    urgency,
    action_required: str(o.action_required, 300),
    risk_flags: flags,
    follow_up_required: o.follow_up_required !== false,
    follow_up_questions: questions,
    prefill: {
      claimant_name: str(p.claimant_name, 150),
      policy_number: str(p.policy_number, 60),
      incident_date: /^\d{4}-\d{2}-\d{2}$/.test(p.incident_date as string)
        ? (p.incident_date as string)
        : "",
      incident_description: str(p.incident_description, 1500),
    },
  };
}
