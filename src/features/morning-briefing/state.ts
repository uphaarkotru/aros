import { createAuditEvent } from "@/decision-control/audit/create-audit-event";
import type { DecisionStatus, GovernedDecision, HumanDecisionState } from "@/domain/decisions/types";

export type HumanStateMap = Record<string, HumanDecisionState>;
export type BriefingAction =
  | { type:"hydrate"; state:HumanStateMap }
  | { type:"set-status"; decision:GovernedDecision; status:DecisionStatus; now:string }
  | { type:"edit"; decision:GovernedDecision; recommendation:string; now:string }
  | { type:"execute"; decision:GovernedDecision; now:string };

function baseState(): HumanDecisionState { return { status:"pending",auditEvents:[] }; }
function event(decision:GovernedDecision,eventType:"approved"|"edited"|"dismissed"|"snoozed"|"ready-for-execution"|"executed",now:string) { return createAuditEvent({decisionId:decision.id,candidateId:decision.candidateId,actorType:eventType === "executed" ? "system" : "human",actorId:eventType === "executed" ? "simulation-engine" : "current-revenue-leader",eventType,timestamp:now,traceId:decision.auditTrail[0]?.traceId ?? decision.candidateId,details:{ simulated:eventType === "executed" }}); }
export function humanWorkflowReducer(state:HumanStateMap,action:BriefingAction):HumanStateMap {
  if (action.type === "hydrate") return action.state;
  const current = state[action.decision.id] ?? baseState();
  if (action.type === "edit") return {...state,[action.decision.id]:{...current,status:"edited",editedRecommendation:action.recommendation,auditEvents:[...current.auditEvents,event(action.decision,"edited",action.now)]}};
  if (action.type === "execute") return {...state,[action.decision.id]:{...current,status:"executed",executionRequestedAt:action.now,executedAt:action.now,auditEvents:[...current.auditEvents,event(action.decision,"executed",action.now)]}};
  const status = action.status === "approved" && action.decision.executionPolicy.requiresApproval ? "ready-for-execution" : action.status;
  const eventType = status === "ready-for-execution" ? "ready-for-execution" : status as "approved"|"dismissed"|"snoozed";
  const approvalEvents = status === "ready-for-execution" ? [event(action.decision,"approved",action.now),event(action.decision,"ready-for-execution",action.now)] : [event(action.decision,eventType,action.now)];
  return {...state,[action.decision.id]:{...current,status,approvedBy:status === "ready-for-execution" ? "current-revenue-leader" : current.approvedBy,approvedAt:status === "ready-for-execution" ? action.now : current.approvedAt,dismissedBy:status === "dismissed" ? "current-revenue-leader" : current.dismissedBy,dismissedAt:status === "dismissed" ? action.now : current.dismissedAt,snoozedUntil:status === "snoozed" ? new Date(new Date(action.now).getTime()+86_400_000).toISOString() : current.snoozedUntil,auditEvents:[...current.auditEvents,...approvalEvents]}};
}
export function mergeHumanState(decision:GovernedDecision,state?:HumanDecisionState):GovernedDecision { return state ? {...decision,status:state.status,recommendedAction:state.editedRecommendation ?? decision.recommendedAction,auditTrail:[...decision.auditTrail,...state.auditEvents]} : decision; }
