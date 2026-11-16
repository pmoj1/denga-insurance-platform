// Keep in sync with the field list in src/config/caseFileSchema.ts

export interface ItemClaimed {
  description: string;
  statedValue?: string;
  evidenceItemIds?: string[];
}

export interface EvidenceEntry {
  evidenceItemId: string;
  fileName: string;
  type: string;
  whatItShows: string;
  keyDetails: string;
}

export interface ReviewFlagContent {
  summary: string;
  explanation: string;
  evidenceItemIds: string[];
}

export interface CaseFileContent {
  claimReference: string;
  dateOfIncident: string;
  claimant: string;
  policyNumber: string;
  coveredAsset: string;
  incidentSummary: string;
  itemsClaimed: ItemClaimed[];
  evidenceInventory: EvidenceEntry[];
  reviewFlags: ReviewFlagContent[];
  underwriterNotes: string;
}
