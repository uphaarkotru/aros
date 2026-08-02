import type {AgentReasoningRequest} from "@/domain/agent-reasoning/types";import type {AgentTask} from "@/domain/agents/types";import type {AgentContextPackage} from "@/domain/llm-context/types";import {reasoningVersions,supportedAgentTypes} from "../config";

export function createAgentReasoningRequest({context,task=context.task,outputSchemaVersion=reasoningVersions.decisionCandidateSchemaVersion,now,deadline}:{context:AgentContextPackage;task?:AgentTask;outputSchemaVersion?:string;now:string;deadline?:string}):AgentReasoningRequest{
 if(!supportedAgentTypes.includes(context.agentType))throw new Error("unsupported-agent");
 if(task.accountId!==context.accountId||task.agentType!==context.agentType)throw new Error("invalid-task");
 return{requestId:`reasoning-request-${task.taskId}-${outputSchemaVersion}`,traceId:`reasoning-trace-${context.contextId}-${task.taskId}`,contextId:context.contextId,contextVersion:context.contextVersion,accountId:context.accountId,agentType:context.agentType,task,outputSchemaVersion,requestedAt:now,deadline,constraints:[...new Set([...task.constraints,"Use only IDs supplied in AgentContextPackage","Do not claim external execution","Return schema-constrained structured output"])],metadata:{requestSchemaVersion:reasoningVersions.requestSchemaVersion,simulated:true}};
}
