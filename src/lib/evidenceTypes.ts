// Single source of truth for what evidence the platform accepts.
// WhatsApp voicenotes arrive as audio/ogg (opus); iPhone recordings as m4a.

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];
export const ACCEPTED_DOCUMENT_TYPES = ["application/pdf"];
export const ACCEPTED_AUDIO_TYPES = [
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
];

export const ACCEPTED_EVIDENCE_TYPES = [
  ...ACCEPTED_IMAGE_TYPES,
  ...ACCEPTED_DOCUMENT_TYPES,
  ...ACCEPTED_AUDIO_TYPES,
];

export const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024;

export const EVIDENCE_ACCEPT_ATTRIBUTE = [
  ".jpg",
  ".jpeg",
  ".png",
  ".pdf",
  ".ogg",
  ".opus",
  ".mp3",
  ".m4a",
  ".aac",
  ".wav",
  ...ACCEPTED_EVIDENCE_TYPES,
].join(",");
