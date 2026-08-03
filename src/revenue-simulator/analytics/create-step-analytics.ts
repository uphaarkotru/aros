import type { AgentEvaluationResult } from "@/domain/agent-evaluation/types";
import type { LLMResponse, LLMUsage } from "@/domain/llm-provider/types";
import type { PromptPackage } from "@/domain/prompts/types";
import type {
  PricingCatalog,
  SimulationBudgetPolicy,
  SimulationStepAnalytics,
} from "@/domain/simulation/analytics-types";
import type {
  SimulationExecutionMode,
  SimulationReview,
} from "@/domain/simulation/types";
import { calculateLLMCost } from "./calculate-cost";
import { evaluateSimulationBudget } from "./budget";
import { calculateSimulationQuality } from "./quality";
import { calculateCostQualityEfficiency } from "./efficiency";
import { simulationAnalyticsConfig } from "./config";

export function createSimulationStepAnalytics({
  executionMode,
  providerId,
  modelId,
  promptVersion,
  promptPackage,
  response,
  historicalUsage,
  historicalLatencyMs,
  evaluation,
  review,
  contextBuildMs = 0,
  evaluationMs,
  orchestrationMs = 0,
  currentSessionCostUsd = 0,
  baselineQuality = 0,
  baselineLatencyMs = 0,
  recommendationImproved = false,
  catalog,
  budgetPolicy,
  liveConfirmed,
  now,
}: {
  executionMode: SimulationExecutionMode;
  providerId: string;
  modelId: string;
  promptVersion?: string;
  promptPackage?: PromptPackage;
  response?: LLMResponse;
  historicalUsage?: LLMUsage;
  historicalLatencyMs?: number;
  evaluation?: AgentEvaluationResult;
  review?: SimulationReview;
  contextBuildMs?: number;
  evaluationMs?: number;
  orchestrationMs?: number;
  currentSessionCostUsd?: number;
  baselineQuality?: number;
  baselineLatencyMs?: number;
  recommendationImproved?: boolean;
  catalog: PricingCatalog;
  budgetPolicy: SimulationBudgetPolicy;
  liveConfirmed: boolean;
  now: string;
}): SimulationStepAnalytics {
  const cost = calculateLLMCost({
    executionMode,
    providerId,
    modelId,
    at: now,
    catalog,
    response,
    promptPackage,
    historicalUsage,
  });
  const latency = {
    contextBuildMs,
    providerMs: executionMode === "real-provider-development" ? response?.latencyMs ?? 0 : 0,
    evaluationMs: evaluationMs ?? evaluation?.diagnostics.evaluationDurationMs ?? 0,
    orchestrationMs,
    totalMs:
      contextBuildMs +
      (executionMode === "real-provider-development" ? response?.latencyMs ?? 0 : 0) +
      (evaluationMs ?? evaluation?.diagnostics.evaluationDurationMs ?? 0) +
      orchestrationMs,
    retryCount: response?.diagnostics.retries ?? 0,
    historicalProviderMs: executionMode === "replay" ? historicalLatencyMs : undefined,
  };
  const quality = calculateSimulationQuality({ evaluation, review });
  const budget = evaluateSimulationBudget({
    cost,
    usage: cost.usage,
    currentSessionCostUsd,
    policy: budgetPolicy,
    liveConfirmed,
  });
  const efficiency = calculateCostQualityEfficiency({
    quality,
    cost,
    latency,
    baselineQuality,
    baselineLatencyMs,
    recommendationImproved,
  });
  return {
    analyticsVersion: simulationAnalyticsConfig.analyticsVersion,
    executionMode,
    providerId,
    modelId,
    promptVersion,
    usage: cost.usage,
    cost,
    latency,
    quality,
    efficiency,
    budget,
    calculatedAt: now,
  };
}
