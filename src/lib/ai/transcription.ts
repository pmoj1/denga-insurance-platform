import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash";
// Inline audio shares the request budget with the prompt; stay well under limits.
const MAX_INLINE_AUDIO_BYTES = 15 * 1024 * 1024;

const TRANSCRIBE_PROMPT = `Transcribe this voice note verbatim.

Rules:
- Write exactly what is said, in the language(s) spoken. Do not translate, summarise, or paraphrase.
- Speakers in Zimbabwe may mix English, Shona, and Ndebele — transcribe each language as spoken.
- If a word or passage is unintelligible, write [unclear] rather than guessing.
- If the audio contains no speech, respond with exactly: [no speech detected]
- Output only the transcript text — no preamble, no notes, no formatting.`;

export function isTranscriptionAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Speech-to-text for voicenote evidence. Output is ALWAYS treated as
 * unverified downstream — the UI must label it and show it next to the audio
 * so a human can check it (accented English/Shona/Ndebele accuracy is unproven).
 */
export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Transcription requires GEMINI_API_KEY to be configured.");
  }
  if (buffer.length > MAX_INLINE_AUDIO_BYTES) {
    throw new Error("Audio file is too large to transcribe (15 MB limit).");
  }

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      { inlineData: { mimeType, data: buffer.toString("base64") } },
      { text: TRANSCRIBE_PROMPT },
    ],
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("The transcription model returned no text.");
  }
  return text;
}
