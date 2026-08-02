import type { DecisionCandidate } from "@/domain/decisions/types";
import type { EvidenceItem } from "@/domain/evidence/types";
import type { DecisionControlPolicy } from "../types";

export interface SupportedCandidate { candidate: DecisionCandidate; evidence: EvidenceItem[]; strength: number; }
const actionKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((word) => !["the", "a", "an", "to", "and"].includes(word)).sort().join(" ");
const similarity = (left: string, right: string) => { const a = new Set(actionKey(left).split(" ")); const b = new Set(actionKey(right).split(" ")); const overlap = [...a].filter((word) => b.has(word)).length; return overlap / Math.max(1, Math.min(a.size, b.size)); };
export function deduplicateCandidates(items: SupportedCandidate[], policy: DecisionControlPolicy) {
  const kept: SupportedCandidate[] = []; const merged: { keptId: string; mergedId: string }[] = [];
  for (const item of [...items].sort((a, b) => b.strength - a.strength || a.candidate.candidateId.localeCompare(b.candidate.candidateId))) {
    const duplicate = kept.find((existing) => {
      const withinWindow = Math.abs(new Date(existing.candidate.generatedAt).getTime() - new Date(item.candidate.generatedAt).getTime()) <= policy.deduplicationWindowDays * 86_400_000;
      const overlap = item.evidence.some((evidence) => existing.evidence.some((other) => other.id === evidence.id));
      return withinWindow && existing.candidate.accountId === item.candidate.accountId && existing.candidate.proposedType === item.candidate.proposedType && (overlap || similarity(existing.candidate.recommendedAction, item.candidate.recommendedAction) >= 0.6);
    });
    if (!duplicate) kept.push(item); else { duplicate.evidence = [...duplicate.evidence, ...item.evidence.filter((evidence) => !duplicate.evidence.some((entry) => entry.id === evidence.id))]; merged.push({ keptId: duplicate.candidate.candidateId, mergedId: item.candidate.candidateId }); }
  }
  return { kept, merged };
}
