import { defaultDecisionControlPolicy, governDecisionCandidates } from "@/decision-control";
import { toDecisionAccountContext } from "@/account-digital-twin";
import { baseAccountDigitalTwins } from "./account-digital-twins";
import { syntheticDecisionCandidates } from "./decision-candidates";
import { syntheticEvidence } from "./evidence";

export const syntheticNow = "2026-08-01T15:02:00.000Z";
export function createSyntheticMorningBriefing() {
  return governDecisionCandidates({ candidates: syntheticDecisionCandidates, accounts: baseAccountDigitalTwins.map(toDecisionAccountContext), evidence: syntheticEvidence, existingDecisions: [], policy: defaultDecisionControlPolicy, now: syntheticNow });
}
