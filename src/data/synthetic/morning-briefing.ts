import { defaultDecisionControlPolicy, governDecisionCandidates } from "@/decision-control";
import { syntheticAccounts } from "./accounts";
import { syntheticDecisionCandidates } from "./decision-candidates";
import { syntheticEvidence } from "./evidence";

export const syntheticNow = "2026-08-01T15:02:00.000Z";
export function createSyntheticMorningBriefing() {
  return governDecisionCandidates({ candidates: syntheticDecisionCandidates, accounts: syntheticAccounts, evidence: syntheticEvidence, existingDecisions: [], policy: defaultDecisionControlPolicy, now: syntheticNow });
}
