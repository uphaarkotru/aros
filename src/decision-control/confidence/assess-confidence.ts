import type { AccountContext } from "@/domain/accounts/types";
import type { ConfidenceAssessment, DecisionCandidate } from "@/domain/decisions/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { DecisionControlPolicy } from "../types";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function assessConfidence(candidate: DecisionCandidate, account: AccountContext, evidence: readonly EvidenceItem[], policy: DecisionControlPolicy, now: string): ConfidenceAssessment {
  const evidenceConfidence = evidence.length ? evidence.reduce((sum, item) => sum + item.reliability, 0) / evidence.length : 0;
  const completenessFields = [account.ownerId, account.renewalDate, account.currency, account.executiveSponsor];
  const contextCompleteness = completenessFields.filter(Boolean).length / completenessFields.length;
  const corroborationScore = clamp(new Set(evidence.map((item) => item.source)).size / policy.minimumIndependentSources);
  const freshnessDays = policy.evidenceFreshnessDays[candidate.proposedType];
  const freshnessScore = evidence.length ? evidence.reduce((sum, item) => { const age = Math.max(0, (new Date(now).getTime() - new Date(item.observedAt).getTime()) / 86_400_000); return sum + clamp(1 - age / freshnessDays); }, 0) / evidence.length : 0;
  const authoritative = evidence.some((item) => ["salesforce", "gong", "product-usage", "support", "calendar"].includes(item.source)) ? 1 : 0;
  const finalConfidence = clamp(candidate.proposedConfidence * 0.35 + evidenceConfidence * 0.25 + contextCompleteness * 0.15 + corroborationScore * 0.10 + freshnessScore * 0.10 + authoritative * 0.05);
  return { modelConfidence: candidate.proposedConfidence, evidenceConfidence, contextCompleteness, corroborationScore, freshnessScore, finalConfidence, explanation: "Deterministic blend of model assessment, evidence reliability, context completeness, corroboration, freshness, and authoritative support." };
}
