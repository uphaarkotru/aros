/** Shared vocabulary for the signal-to-outcome operating rhythm. */
export type RevenueOperatingStage =
  | "SIGNAL"
  | "INSIGHT"
  | "DECISION"
  | "ACTION"
  | "OWNERSHIP"
  | "OUTCOME"
  | "INSTITUTIONAL_MEMORY";

export type RevenueCadenceKind =
  | "SELLER_MANAGEMENT"
  | "DEAL_EXECUTION"
  | "STRATEGIC_INTERVENTION"
  | "REGIONAL_OPERATING"
  | "EXECUTIVE_OPERATING";

export interface RevenueOperatingItem {
  id: string;
  stage: RevenueOperatingStage;
  title: string;
  summary: string;
  accountName?: string;
  opportunityName?: string;
  revenueImpact?: number;
  ownerName?: string;
  dueAt?: string;
  evidence?: string[];
  recommendedAction?: string;
  status?: string;
}

export const revenueCadenceLabels: Record<RevenueCadenceKind, string> = {
  SELLER_MANAGEMENT: "AE–RSM 1:1",
  DEAL_EXECUTION: "Deal execution",
  STRATEGIC_INTERVENTION: "Strategic 2x2",
  REGIONAL_OPERATING: "Regional operating review",
  EXECUTIVE_OPERATING: "Executive revenue review",
};
