import type { AgentEvaluationResult, CandidateEligibilityResult, EvaluationVerdict } from "@/domain/agent-evaluation/types";
import type { AgentOutputParseResult } from "@/domain/agent-reasoning/types";
import type { AgentType, AgentTaskType } from "@/domain/agents/types";
import type { DecisionCandidate, GovernedDecision } from "@/domain/decisions/types";
import type { EvaluationArtifact, ArtifactReplayResult } from "@/domain/evaluation-artifacts/types";
import type { AgentContextBuildResult, AgentContextPackage } from "@/domain/llm-context/types";
import type { LLMRequest, LLMResponse } from "@/domain/llm-provider/types";
import type { PromptBuildResult, PromptDefinition, PromptPackage, PromptSelectionResult } from "@/domain/prompts/types";
import type { SimulationStepAnalytics } from "@/domain/simulation/analytics-types";
import type { DecisionControlResult } from "@/decision-control";

export type AIExecutionStatus = "pending" | "running" | "completed" | "completed-with-warnings" | "failed" | "cancelled" | "timed-out" | "replayed";
export type AIExecutionStageStatus = "not-started" | "running" | "completed" | "completed-with-warnings" | "failed" | "skipped" | "unavailable";
export type AIExecutionMode = "deterministic" | "replay" | "real-provider-development";
export type AIExecutionStageKey = "source" | "reconciliation" | "digital-twin" | "context" | "prompt" | "provider" | "parsing" | "evaluation" | "eligibility" | "governance" | "economics" | "artifact" | "workspace";

export interface AIExecutionStage<T> {
  stageId: string;
  stageName: string;
  status: AIExecutionStageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  inputReferences: string[];
  output?: T;
  warnings: string[];
  errors: string[];
  auditEventIds: string[];
  contentHash?: string;
  versionMetadata: Record<string, string>;
  diagnostics: Record<string, string | number | boolean>;
}

export interface SourceStageSnapshot { sourceRecordIds: string[]; addedSourceRecordIds: string[]; synthetic: boolean; rawPayloadsIncluded: false; }
export interface ReconciliationStageSnapshot { contextId: string; factIds: string[]; conflictIds: string[]; sourceRecordCount: number; }
export interface DigitalTwinStageSnapshot { accountId: string; accountName: string; generatedAt: string; healthScore: number; renewalLikelihood: number; evidenceIds: string[]; activeDecisionIds: string[]; }
export interface ContextStageSnapshot { build: AgentContextBuildResult; context?: AgentContextPackage; }
export interface PromptStageSnapshot { selection?: PromptSelectionResult; definition?: PromptDefinition; build?: PromptBuildResult; promptPackage?: PromptPackage; selectionReason?: string; }
export interface ProviderStageSnapshot { request?: LLMRequest; response?: LLMResponse; translatedRequest?: unknown; translatedRequestRedacted: boolean; rawOutputAvailable: boolean; capabilitySummary?: Record<string, string | number | boolean>; }
export interface ParsingStageSnapshot { parseResult: AgentOutputParseResult; rawOutput?: unknown; candidate?: DecisionCandidate; }
export interface EvaluationStageSnapshot { evaluation: AgentEvaluationResult; }
export interface EligibilityStageSnapshot { eligibility: CandidateEligibilityResult; }
export interface GovernanceStageSnapshot { result: DecisionControlResult; candidate?: DecisionCandidate; governedDecisions: GovernedDecision[]; }
export interface EconomicsStageSnapshot { analytics: SimulationStepAnalytics; }
export interface ArtifactStageSnapshot { artifact: EvaluationArtifact; replay?: ArtifactReplayResult; }
export interface WorkspaceStageSnapshot { destination: "renewal-workspace" | "morning-briefing"; decisionIds: string[]; }

export interface AIExecutionTrace {
  traceId: string; requestId: string; runId: string; sessionId?: string; stepId?: string; scenarioId?: string;
  accountId: string; accountName: string; agentType: AgentType; taskType: AgentTaskType; executionMode: AIExecutionMode;
  status: AIExecutionStatus; createdAt: string; completedAt?: string;
  sourceStage: AIExecutionStage<SourceStageSnapshot>;
  reconciliationStage: AIExecutionStage<ReconciliationStageSnapshot>;
  digitalTwinStage: AIExecutionStage<DigitalTwinStageSnapshot>;
  contextStage: AIExecutionStage<ContextStageSnapshot>;
  promptStage: AIExecutionStage<PromptStageSnapshot>;
  providerStage: AIExecutionStage<ProviderStageSnapshot>;
  parsingStage: AIExecutionStage<ParsingStageSnapshot>;
  evaluationStage: AIExecutionStage<EvaluationStageSnapshot>;
  eligibilityStage: AIExecutionStage<EligibilityStageSnapshot>;
  governanceStage: AIExecutionStage<GovernanceStageSnapshot>;
  economicsStage: AIExecutionStage<EconomicsStageSnapshot>;
  artifactStage: AIExecutionStage<ArtifactStageSnapshot>;
  workspaceStage: AIExecutionStage<WorkspaceStageSnapshot>;
  warnings: string[]; errors: string[];
  metadata: { consoleVersion: string; traceSchemaVersion: string; redactionPolicyVersion: string; developmentOnly: true; replay: boolean; provider?: string; model?: string; promptVersion?: string; evaluationVerdict?: EvaluationVerdict; eligible?: boolean; };
}

export interface AIConsoleTraceFilter { accountId?: string; scenarioId?: string; executionMode?: AIExecutionMode; promptVersion?: string; provider?: string; model?: string; verdict?: EvaluationVerdict; eligible?: boolean; status?: AIExecutionStatus; query?: string; }
export interface AIConsoleSearchMatch { stage: AIExecutionStageKey; path: string; excerpt: string; }
export interface AITraceComparison { compatible: boolean; errors: string[]; prompt: { changed: boolean; addedInstructions: string[]; removedInstructions: string[]; changedSections: string[]; tokenDelta: number; }; recommendation: { changeTypes: string[]; claimChanges: string[]; evidenceChanges: string[]; confidenceDelta: number; priorityChange?: string; outcomeChanged: boolean; classification: "improved" | "regressed" | "changed" | "unchanged"; }; economics: { costDeltaUsd?: number; latencyDeltaMs?: number; qualityDelta?: number; }; }
export interface AIConsoleExport { filename: string; mimeType: "application/json" | "text/markdown"; content: string; contentHash: string; truncated: boolean; redactionPolicyVersion: string; }
