import { defaultDecisionControlPolicy, governDecisionCandidates } from "@/decision-control";
import { priorityFromScore } from "@/decision-control/priority/calculate-priority";
import { syntheticAccounts } from "@/data/synthetic/accounts";
import { syntheticDecisionCandidates } from "@/data/synthetic/decision-candidates";
import { syntheticEvidence } from "@/data/synthetic/evidence";
import { syntheticNow } from "@/data/synthetic/morning-briefing";
import type { DecisionCandidate } from "@/domain/decisions/types";
import { describe, expect, it } from "vitest";

const valid = syntheticDecisionCandidates[0] as DecisionCandidate;
const run = (candidates:readonly unknown[]=syntheticDecisionCandidates, accounts=syntheticAccounts, evidence=syntheticEvidence, policy=defaultDecisionControlPolicy) => governDecisionCandidates({candidates,accounts,evidence,existingDecisions:[],policy,now:syntheticNow});

describe("decision control public pipeline",()=>{
  it("validates candidate schema",()=>{ expect(run([{candidateId:"bad"}]).rejectedCandidates[0].issues.some((i)=>i.code==="required-field")).toBe(true); });
  it("rejects an unknown account",()=>{ expect(run([{...valid,candidateId:"unknown",accountId:"missing"}]).rejectedCandidates[0].issues[0].code).toBe("unknown-account"); });
  it("rejects missing evidence",()=>{ expect(run([{...valid,candidateId:"missing",evidenceIds:["not-real"]}]).rejectedCandidates[0].issues.some((i)=>i.code==="missing-evidence")).toBe(true); });
  it("rejects account and evidence mismatch",()=>{ expect(run([{...valid,candidateId:"mismatch",evidenceIds:["ev-pp-opportunity"]}]).rejectedCandidates[0].issues.some((i)=>i.code==="evidence-account-mismatch")).toBe(true); });
  it("enforces evidence freshness",()=>{ expect(run([{...valid,candidateId:"stale",accountId:"acct-snowflake",evidenceIds:["ev-stale"],proposedBusinessImpactValue:1_800_000}]).rejectedCandidates[0].issues.some((i)=>i.code==="stale-evidence")).toBe(true); });
  it("enforces evidence reliability",()=>{ const low=syntheticEvidence.map((e)=>e.id==="ev-cb-security"?{...e,reliability:.1}:e);expect(run([{...valid,evidenceIds:["ev-cb-security"]}],syntheticAccounts,low).rejectedCandidates[0].issues.some((i)=>i.code==="insufficient-evidence-reliability")).toBe(true); });
  it("verifies renewal impact against ACV",()=>{ expect(run([valid]).acceptedDecisions[0].verifiedBusinessImpactValue).toBe(22_400_000); });
  it("flags a financial impact mismatch",()=>{ const d=run([{...valid,proposedBusinessImpactValue:100_000_000}]).acceptedDecisions[0];expect(d.governanceFlags).toContain("impact-mismatch"); });
  it("adjusts model confidence deterministically",()=>{ const d=run([valid]).acceptedDecisions[0];expect(d.confidence).not.toBe(valid.proposedConfidence);expect(run([valid]).acceptedDecisions[0].confidence).toBe(d.confidence); });
  it("enforces the adjusted confidence floor",()=>{ const result=run([{...valid,candidateId:"weak",proposedConfidence:.05}],syntheticAccounts,syntheticEvidence,{...defaultDecisionControlPolicy,minimumConfidence:.95});expect(result.rejectedCandidates[0].issues[0].code).toBe("confidence-below-floor"); });
  it("calculates a weighted priority score",()=>{ const d=run([valid]).acceptedDecisions[0];expect(d.priorityScore).toBe(d.scoringBreakdown.total);expect(d.priorityScore).toBeGreaterThan(0); });
  it("maps priority thresholds",()=>{ expect(priorityFromScore(85,defaultDecisionControlPolicy)).toBe("critical");expect(priorityFromScore(70,defaultDecisionControlPolicy)).toBe("high");expect(priorityFromScore(50,defaultDecisionControlPolicy)).toBe("medium");expect(priorityFromScore(49,defaultDecisionControlPolicy)).toBe("low"); });
  it("includes strategic tier in scoring",()=>{ const tierOne=run([valid]).acceptedDecisions[0];const accounts=syntheticAccounts.map((a)=>a.id===valid.accountId?{...a,strategicTier:3 as const}:a);const tierThree=run([valid],accounts).acceptedDecisions[0];expect(tierOne.priorityScore).toBeGreaterThan(tierThree.priorityScore); });
  it("deduplicates overlapping decisions",()=>{ expect(run().diagnostics.deduplicationEvents).toBe(1);expect(run().acceptedDecisions).toHaveLength(8); });
  it("merges nonduplicative evidence",()=>{ const d=run().acceptedDecisions.find((item)=>item.candidateId==="coinbase-renewal");expect(d?.evidence.map((e)=>e.id)).toEqual(expect.arrayContaining(["ev-cb-security","ev-cb-sponsor","ev-cb-email"])); });
  it("assigns approval policy",()=>{ expect(run([valid]).acceptedDecisions[0].approvalPolicy.approvalRequired).toBe(true); });
  it("requires executive approval above threshold",()=>{ const d=run([valid]).acceptedDecisions[0];expect(d.approvalPolicy.requiredRole).toBe("executive");expect(d.governanceFlags).toContain("executive-approval-required"); });
  it("blocks external execution",()=>{ const p=run([valid]).acceptedDecisions[0].executionPolicy;expect(p.blockedActions).toContain("send-email");expect(p.allowedActions).toContain("simulate-execution"); });
  it("produces stable deterministic ranking",()=>{ const first=run().acceptedDecisions.map((d)=>d.id);const second=run([...syntheticDecisionCandidates].reverse()).acceptedDecisions.map((d)=>d.id);expect(second).toEqual(first); });
  it("generates deterministic audit events",()=>{ const first=run([valid]).auditEvents;const second=run([valid]).auditEvents;expect(first.length).toBeGreaterThan(4);expect(second.map((e)=>e.id)).toEqual(first.map((e)=>e.id)); });
  it("handles empty input",()=>{ const result=run([]);expect(result.acceptedDecisions).toEqual([]);expect(result.diagnostics.candidateCount).toBe(0); });
  it("handles malformed candidates without throwing",()=>{ const result=run([null,"bad",{candidateId:"partial"}]);expect(result.rejectedCandidates).toHaveLength(3);expect(result.acceptedDecisions).toEqual([]); });
});
