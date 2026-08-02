export type EvidenceSource = "salesforce" | "gong" | "email" | "calendar" | "product-usage" | "support" | "external-news" | "manual" | "synthetic";

export interface EvidenceItem {
  id: string;
  accountId: string;
  source: EvidenceSource;
  type: string;
  title: string;
  summary: string;
  observedAt: string;
  reliability: number;
  sourceRecordId: string;
  metadata: Record<string, string | number | boolean | null>;
}
