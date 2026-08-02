import type { AccountContext } from "@/domain/accounts/types";
import type { ConfidenceAssessment, DecisionCandidate, DecisionPriority, ScoringBreakdown } from "@/domain/decisions/types";
import type { DecisionControlPolicy } from "../types";

const clamp100 = (value: number) => Math.max(0, Math.min(100, value));
export function priorityFromScore(score: number, policy: DecisionControlPolicy): DecisionPriority { return score >= policy.priorityThresholds.critical ? "critical" : score >= policy.priorityThresholds.high ? "high" : score >= policy.priorityThresholds.medium ? "medium" : "low"; }
export function calculatePriority(candidate: DecisionCandidate, account: AccountContext, verifiedValue: number, confidence: ConfidenceAssessment, policy: DecisionControlPolicy, now: string): ScoringBreakdown {
  const daysToDue = candidate.dueAt ? (new Date(candidate.dueAt).getTime() - new Date(now).getTime()) / 86_400_000 : 30;
  const businessImpact = clamp100(verifiedValue / policy.executiveApprovalThreshold * 100);
  const urgency = clamp100(candidate.proposedType === "renewal-risk" ? (1 - Math.max(0, new Date(account.renewalDate).getTime() - new Date(now).getTime()) / (180 * 86_400_000)) * 100 : (1 - Math.max(0, daysToDue) / 60) * 100);
  const confidenceScore = confidence.finalConfidence * 100;
  const strategicImportance = account.strategicTier === 1 ? 100 : account.strategicTier === 2 ? 70 : 40;
  const timeSensitivity = clamp100((1 - Math.max(0, daysToDue) / 30) * 100);
  const corroboration = confidence.corroborationScore * 100;
  const humanAttention = candidate.requiredHumanDecision ? 100 : 35;
  const weights = policy.priorityWeights;
  const total = Math.round((businessImpact * weights.businessImpact + urgency * weights.urgency + confidenceScore * weights.confidence + strategicImportance * weights.strategicImportance + timeSensitivity * weights.timeSensitivity + corroboration * weights.corroboration + humanAttention * weights.humanAttention) * 100) / 100;
  return { businessImpact, urgency, confidence: confidenceScore, strategicImportance, timeSensitivity, corroboration, humanAttention, total };
}
