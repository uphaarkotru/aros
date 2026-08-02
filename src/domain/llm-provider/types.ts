import type {AgentOutputParseResult,AgentReasoningMetadata} from "@/domain/agent-reasoning/types";
import type {DecisionCandidate} from "@/domain/decisions/types";
import type {PromptPackage} from "@/domain/prompts/types";

export type LLMFinishReason="stop"|"length"|"content-filter"|"error"|"unknown";
export type LLMResponseFormat="json-object"|"json-string"|"malformed-json"|"text";
export type LLMProviderErrorCode="timeout"|"cancelled"|"rate-limit"|"provider-unavailable"|"authentication-failed"|"authorization-failed"|"capability-mismatch"|"configuration-error"|"transient-failure"|"invalid-json"|"schema-violation"|"malformed-output"|"invalid-request"|"unsupported-model"|"replay-missing"|"retry-exhausted";
export interface LLMUsage{inputTokens:number;outputTokens:number;totalTokens:number;estimated:boolean;}
export interface LLMRetryAttempt{attempt:number;startedAt:string;completedAt:string;errorCode?:LLMProviderErrorCode;retryable:boolean;delayMs:number;}
export interface LLMDiagnostics{requestSizeBytes:number;responseSizeBytes:number;latencyMs:number;attemptCount:number;retries:number;retryAttempts:LLMRetryAttempt[];normalizationWarnings:string[];providerRequestId?:string;fixtureId?:string;recordingId?:string;}
export interface LLMRequest{requestId:string;traceId:string;promptPackage:PromptPackage;model:string;temperature:number;maxTokens:number;timeoutMs:number;responseSchemaVersion:string;metadata:Record<string,string|number|boolean>;}
export interface LLMResponse{responseId:string;requestId:string;provider:string;model:string;latencyMs:number;finishReason:LLMFinishReason;format:LLMResponseFormat;rawOutput:unknown;parsedOutput?:unknown;usage:LLMUsage;diagnostics:LLMDiagnostics;createdAt:string;}
export interface LLMValidationIssue{code:LLMProviderErrorCode;message:string;field?:string;recoverable:boolean;}
export interface LLMValidationResult{valid:boolean;errors:LLMValidationIssue[];warnings:LLMValidationIssue[];validatedAt:string;}
export interface LLMHealthCheckResult{provider:string;healthy:boolean;status:"healthy"|"degraded"|"unavailable";checkedAt:string;message:string;diagnostics:Record<string,string|number|boolean>;}
export interface LLMGenerationOptions{signal?:AbortSignal;timeoutMs?:number;executionContext?:unknown;}
export interface LLMProvider{id:string;name:string;version:string;generate(request:LLMRequest,options?:LLMGenerationOptions):Promise<LLMResponse>;validate(request:LLMRequest):Promise<LLMValidationResult>;healthCheck():Promise<LLMHealthCheckResult>;}
export type LLMStreamingEventType="response-start"|"content-delta"|"response-complete"|"error";
export interface LLMStreamingEvent{type:LLMStreamingEventType;sequence:number;content?:string;response?:LLMResponse;error?:LLMValidationIssue;}
export interface LLMStreamingProvider{stream(request:LLMRequest):AsyncIterable<LLMStreamingEvent>;}
export type ModelStatus="active"|"experimental"|"deprecated"|"unavailable"|"disabled";
export interface ModelDefinition{provider:string;modelId:string;maxContextTokens:number;maxOutputTokens:number;supportsJSON:boolean;supportsStreaming:boolean;supportsToolCalling:boolean;status:ModelStatus;synthetic:boolean;metadata:Record<string,string|number|boolean>;}
export interface ModelRegistry{version:string;models:readonly ModelDefinition[];defaults:Record<string,string>;}
export interface ModelSelectionResult{model?:ModelDefinition;errors:LLMValidationIssue[];warnings:LLMValidationIssue[];}
export interface LLMRetryPolicy{version:string;maximumAttempts:number;retryableErrorCodes:LLMProviderErrorCode[];initialDelayMs:number;backoffMultiplier:number;maximumDelayMs:number;jitter:boolean;}
export interface LLMExecutionDependencies{now:()=>string;nowMs:()=>number;delay:(milliseconds:number)=>Promise<void>;}
export interface LLMExecutionResult{request:LLMRequest;response?:LLMResponse;errors:LLMValidationIssue[];attempts:LLMRetryAttempt[];model?:ModelDefinition;}
export interface LLMReplayFixture{replayKey:string;provider:string;model:string;format:LLMResponseFormat;rawOutput:unknown;finishReason:LLMFinishReason;usage?:Partial<LLMUsage>;fixtureId:string;}
export interface LLMRecording{recordingId:string;recordedAt:string;request:LLMRequest;response?:LLMResponse;error?:LLMValidationIssue;replayFixture?:LLMReplayFixture;}
export interface LLMRecorder{record(recording:LLMRecording):void;list():readonly LLMRecording[];}
export interface ProviderReasoningResult{request:LLMRequest;execution:LLMExecutionResult;parseResult:AgentOutputParseResult;candidate?:DecisionCandidate;metadata:AgentReasoningMetadata;}
