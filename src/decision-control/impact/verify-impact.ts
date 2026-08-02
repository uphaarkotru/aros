import type { AccountContext } from "@/domain/accounts/types";
import type { DecisionCandidate, ImpactVerificationResult } from "@/domain/decisions/types";
import type { DecisionControlPolicy } from "../types";

export function verifyFinancialImpact(candidate: DecisionCandidate, account: AccountContext, policy: DecisionControlPolicy): ImpactVerificationResult {
  let verifiedValue = 0; let source = "No direct financial impact";
  if (["renewal-risk", "relationship-risk", "executive-action"].includes(candidate.proposedType)) { verifiedValue = account.annualContractValue; source = "Account annualContractValue"; }
  if (["expansion-opportunity", "forecast-risk"].includes(candidate.proposedType)) { verifiedValue = account.openOpportunityValue; source = "Account openOpportunityValue"; }
  if (candidate.proposedType === "meeting-preparation") { verifiedValue = Math.max(account.openOpportunityValue, account.annualContractValue); source = "Influenced account value"; }
  const variance = candidate.proposedBusinessImpactValue - verifiedValue;
  const tolerance = verifiedValue === 0 ? 0 : Math.abs(variance) / verifiedValue;
  return { proposedValue: candidate.proposedBusinessImpactValue, verifiedValue, variance, source, accepted: tolerance <= policy.financialImpactTolerance, explanation: tolerance <= policy.financialImpactTolerance ? `Proposed impact aligns with ${source}.` : `Proposed impact adjusted to authoritative ${source}.` };
}

export function formatImpact(value: number, type: DecisionCandidate["proposedType"]): string {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
  if (type === "renewal-risk" || type === "relationship-risk") return `${formatted} ARR at risk`;
  if (type === "meeting-preparation") return `${formatted} influenced`;
  return `${formatted} potential`;
}
