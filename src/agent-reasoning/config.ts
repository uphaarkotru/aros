import type {AgentType} from "@/domain/agents/types";
import type {DecisionType} from "@/domain/decisions/types";

export const reasoningVersions={requestSchemaVersion:"agent-reasoning-request-v1",decisionCandidateSchemaVersion:"decision-candidate-v2",claimSchemaVersion:"decision-claim-v1",evaluationSchemaVersion:"agent-evaluation-v1",evaluationPolicyVersion:"evaluation-policy-v1",auditVersion:"agent-reasoning-audit-v1",scenarioVersion:"golden-scenarios-v1"} as const;
export const supportedAgentTypes:AgentType[]=["renewal-agent","expansion-agent","relationship-agent","forecast-agent","executive-agent","meeting-preparation-agent"];
export const allowedDecisionTypes:Record<AgentType,DecisionType[]>={
 "renewal-agent":["renewal-risk","executive-action"],
 "expansion-agent":["expansion-opportunity","executive-action"],
 "relationship-agent":["relationship-risk"],
 "forecast-agent":["forecast-risk"],
 "executive-agent":["executive-action","renewal-risk","expansion-opportunity","forecast-risk","relationship-risk"],
 "meeting-preparation-agent":["meeting-preparation"]
};
export const responsibleAgentNames:Record<AgentType,string>={"renewal-agent":"Renewal Agent","expansion-agent":"Expansion Agent","relationship-agent":"Relationship Agent","forecast-agent":"Forecast Agent","executive-agent":"Executive Agent","meeting-preparation-agent":"Meeting Preparation Agent"};
