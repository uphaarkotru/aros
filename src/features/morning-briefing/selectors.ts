import type { GovernedDecision } from "@/domain/decisions/types";
const activeStatuses = new Set(["pending","approved","edited","snoozed","ready-for-execution"]);
export function activeDecisions(decisions:readonly GovernedDecision[]) { return decisions.filter((item)=>activeStatuses.has(item.status)); }
export function intelligenceFeed(decisions:readonly GovernedDecision[]) { return activeDecisions(decisions).slice(0,3); }
export function decisionQueue(decisions:readonly GovernedDecision[]) { return activeDecisions(decisions).filter((item)=>item.status !== "executed"); }
export function queueMetrics(decisions:readonly GovernedDecision[],highImpactThreshold:number) { const queue=decisionQueue(decisions); return {count:queue.length,highImpactCount:queue.filter((item)=>item.verifiedBusinessImpactValue>=highImpactThreshold).length,influencedRevenue:queue.reduce((sum,item)=>sum+item.verifiedBusinessImpactValue,0)}; }
