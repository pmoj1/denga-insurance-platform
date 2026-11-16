/**
 * ============================================================================
 * CASE FILE SCHEMA — PLACEHOLDER CONFIG
 * ============================================================================
 * The ONLY place that defines what fields appear in a generated case file.
 * Replace/extend with the exact fields the broker's underwriters require —
 * the system prompt, types, and display all derive from here.
 *
 * Two fields are structural and must stay (guardrails):
 *  - evidenceInventory: every entry cites the EvidenceItem id it came from
 *  - reviewFlags: every flag is explained and evidence-cited; never a score
 * ============================================================================
 */

export type CaseFileFieldType =
  | "string"
  | "itemsClaimed[]"
  | "evidenceInventory[]"
  | "reviewFlags[]";

export interface CaseFileFieldDef {
  key: string;
  label: string;
  type: CaseFileFieldType;
  /** Instruction given to Claude describing exactly what goes in this field. */
  instruction: string;
}

export const CASE_FILE_SCHEMA: CaseFileFieldDef[] = [
  {
    key: "claimReference",
    label: "Claim Reference",
    type: "string",
    instruction:
      "The claim reference provided in the claim metadata. Use the metadata value; do not invent one.",
  },
  {
    key: "dateOfIncident",
    label: "Date of Incident",
    type: "string",
    instruction:
      'The incident date as supported by the evidence or claim metadata. Use "Not found in evidence" if absent.',
  },
  {
    key: "claimant",
    label: "Claimant",
    type: "string",
    instruction:
      'Full name of the claimant as it appears in the evidence or claim metadata. Use "Not found in evidence" if absent.',
  },
  {
    key: "policyNumber",
    label: "Policy Number",
    type: "string",
    instruction:
      'The policy number as it appears in the evidence or claim metadata. Use "Not found in evidence" if absent.',
  },
  {
    key: "coveredAsset",
    label: "Covered Asset",
    type: "string",
    instruction:
      'The insured asset involved (e.g. vehicle registration/make/model, or property address) as stated in the evidence. Use "Not found in evidence" if absent.',
  },
  {
    key: "incidentSummary",
    label: "Incident Summary",
    type: "string",
    instruction:
      "A 3-5 sentence plain-English narrative of what happened, built only from facts the evidence supports. Do not speculate beyond what is documented.",
  },
  {
    key: "itemsClaimed",
    label: "Items Claimed",
    type: "itemsClaimed[]",
    instruction:
      "Every distinct item, loss, or damage being claimed. For each: a description, the stated value ONLY where a monetary value appears in the evidence (never estimate one yourself), and the evidence item ids that support it. When no value is stated, OMIT the statedValue field entirely — never put placeholder text, notes, or commentary in it.",
  },
  {
    key: "evidenceInventory",
    label: "Evidence Inventory",
    type: "evidenceInventory[]",
    instruction:
      "One entry per evidence file, in the order provided, citing that file's evidence item id exactly as given in the manifest. For each: the file type, what it shows, and the key details it supports.",
  },
  {
    key: "reviewFlags",
    label: "Items for Underwriter Review",
    type: "reviewFlags[]",
    instruction:
      "Inconsistencies and gaps a human reviewer should examine: contradictory dates or values across evidence, missing expected documents, mismatched details, damage inconsistent with the described incident. Each flag needs a one-line summary, an explanation stating precisely which files/details triggered it, and the ids of those evidence items. Empty array if none — do not invent flags. NEVER output a score, rating, or accept/deny recommendation.",
  },
  {
    key: "underwriterNotes",
    label: "Underwriter Notes",
    type: "string",
    instruction:
      "A short, direct note on what a human reviewer should check or verify first. Surface questions, not verdicts.",
  },
];
