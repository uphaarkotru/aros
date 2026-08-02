import type { ApprovalPolicy, DecisionCandidate, DecisionPriority } from "@/domain/decisions/types";
import type { DecisionControlPolicy } from "../types";

export function evaluateApproval(candidate: DecisionCandidate, priority: DecisionPriority, impact: number, policy: DecisionControlPolicy): ApprovalPolicy {
  const executive = impact >= policy.executiveApprovalThreshold;
  const required = priority === "critical" || impact >= policy.highImpactThreshold || candidate.requiredHumanDecision;
  return { approvalRequired: required, requiredRole: executive ? "executive" : required ? "revenue-leader" : "account-owner", minimumApprovers: executive ? 2 : required ? 1 : 0, reason: executive ? "Verified impact exceeds the executive approval threshold." : required ? "Priority, impact, or requested human judgment requires approval." : "Recommendation is below mandatory approval thresholds.", allowSelfApproval: candidate.proposedType !== "executive-action", escalationPath: executive ? ["revenue-leader", "executive"] : required ? ["revenue-leader"] : [] };
}
