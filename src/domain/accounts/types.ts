export type AccountSegment = "enterprise" | "strategic" | "commercial";
export type StrategicTier = 1 | 2 | 3;

export interface AccountContext {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  segment: AccountSegment;
  annualContractValue: number;
  renewalDate: string;
  openOpportunityValue: number;
  strategicTier: StrategicTier;
  healthScore: number;
  currency: "USD";
  executiveSponsor: string | null;
  accountStatus: "active" | "inactive";
  stakeholderEngagement?: string;
  productUsageTrend?: string;
  qualificationGaps?: string[];
  activeRisks?: string[];
  dataQualityScore?: number;
  provenanceSourceIds?: string[];
  reconciliationConfidence?: number;
  staleFactCount?: number;
  criticalConflictCount?: number;
  unsupportedFactCount?: number;
  humanVerifiedFactIds?: string[];
}
