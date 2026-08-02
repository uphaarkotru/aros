import type {AgentTask,AgentType} from "@/domain/agents/types";
import type {DecisionCandidate} from "@/domain/decisions/types";
import type {AgentContextPackage} from "@/domain/llm-context/types";
import type {PromptPackage} from "@/domain/prompts/types";

export type AgentReasonerResponseFormat="structured-object"|"json-string"|"malformed-json"|"partial-object";
export interface AgentReasoningRequest{requestId:string;traceId:string;contextId:string;contextVersion:string;accountId:string;agentType:AgentType;task:AgentTask;outputSchemaVersion:string;requestedAt:string;deadline?:string;constraints:string[];metadata:Record<string,string|number|boolean>;}
export interface AgentReasonerDiagnostics{steps:string[];warningCount:number;fixtureId?:string;}
export interface AgentReasonerResponse{rawOutput:unknown;format:AgentReasonerResponseFormat;generatedAt:string;metadata:Record<string,string|number|boolean>;simulated:true;diagnostics:AgentReasonerDiagnostics;}
export interface AgentReasoner{id:string;name:string;version:string;supportedAgentTypes:AgentType[];supportedOutputSchemaVersions:string[];reason(request:AgentReasoningRequest,context:AgentContextPackage,promptPackage?:PromptPackage):AgentReasonerResponse;}
export interface AgentOutputParseIssue{code:string;field:string;message:string;severity:"warning"|"error";}
export interface RawOutputMetadata{format:AgentReasonerResponseFormat;size:number;unknownFields:string[];}
export interface AgentOutputParseResult{success:boolean;candidate?:DecisionCandidate;normalizedOutput?:Record<string,unknown>;errors:AgentOutputParseIssue[];warnings:AgentOutputParseIssue[];rawOutputMetadata:RawOutputMetadata;schemaVersion:string;parsedAt:string;}
export interface AgentReasoningMetadata{reasonerId:string;reasonerVersion:string;simulated:boolean;provider?:string;model?:string;promptVersion?:string;contextVersion:string;outputSchemaVersion:string;requestId:string;traceId:string;startedAt:string;completedAt:string;latencyMs:number;retryCount:number;rawOutputFormat:AgentReasonerResponseFormat;parseStatus:"passed"|"failed";tokenUsage?:number;costEstimate?:number;}
export type AgentReasoningAuditEventType="reasoning-request-created"|"reasoner-started"|"reasoner-completed"|"reasoner-failed"|"output-parsed"|"output-parse-failed"|"evaluation-started"|"evaluation-completed"|"candidate-passed"|"candidate-warning"|"candidate-review-required"|"candidate-failed"|"candidate-eligible"|"candidate-ineligible"|"candidate-sent-to-governance";
export interface AgentReasoningAuditEvent{id:string;traceId:string;requestId:string;contextId:string;candidateId?:string;evaluationId?:string;actorType:"agent-reasoner"|"evaluation-harness"|"system";eventType:AgentReasoningAuditEventType;timestamp:string;details:Record<string,string|number|boolean>;}
export interface AgentReasoningError{code:"missing-context"|"invalid-task"|"unsupported-agent"|"unsupported-schema"|"reasoner-failure"|"reasoner-timeout"|"empty-output";message:string;recoverable:boolean;}
export interface AgentReasoningResult{request:AgentReasoningRequest;response?:AgentReasonerResponse;parseResult:AgentOutputParseResult;candidate?:DecisionCandidate;metadata:AgentReasoningMetadata;auditEvents:AgentReasoningAuditEvent[];errors:AgentReasoningError[];}
