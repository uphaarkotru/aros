import type {DecisionType} from "@/domain/decisions/types";

export type AgentType="renewal-agent"|"expansion-agent"|"relationship-agent"|"forecast-agent"|"executive-agent"|"meeting-preparation-agent";
export type AgentTaskType="assess-risk"|"identify-opportunity"|"prepare-meeting"|"review-relationship"|"review-forecast"|"recommend-executive-action";
export interface AgentTask{taskId:string;agentType:AgentType;objective:string;accountId:string;requestedAt:string;requestedBy:string;taskType:AgentTaskType;decisionTypesInScope:DecisionType[];timeHorizon:{start:string;end:string};urgency:"critical"|"high"|"medium"|"low";constraints:string[];requestedOutputVersion:string;}

