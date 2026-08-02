import type { GovernedDecision } from "@/domain/decisions/types";
export function rankDecisions(decisions: readonly GovernedDecision[]): GovernedDecision[] {
  return [...decisions].sort((a, b) => b.priorityScore - a.priorityScore || b.verifiedBusinessImpactValue - a.verifiedBusinessImpactValue || b.scoringBreakdown.urgency - a.scoringBreakdown.urgency || b.confidence - a.confidence || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
