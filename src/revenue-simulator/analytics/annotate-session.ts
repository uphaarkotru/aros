import type { LLMUsage } from "@/domain/llm-provider/types";
import type { SimulationSession } from "@/domain/simulation/types";
import { aggregateSimulationAnalytics } from "./aggregate-session";
import { createSimulationStepAnalytics } from "./create-step-analytics";
import {
  defaultSimulationBudgetPolicy,
  developmentPricingCatalog,
} from "./config";

export function attachSimulationAnalytics(session: SimulationSession): SimulationSession {
  let currentSessionCostUsd = 0;
  const baselineQuality = session.baselineState.evaluations[0]?.overallScore ?? 0;
  const steps = session.simulationSteps.map((step) => {
    const artifact = step.state.artifacts[0];
    const historicalUsage: LLMUsage | undefined =
      session.executionMode === "replay" && artifact
        ? {
            inputTokens: artifact.observability.inputTokens,
            outputTokens: artifact.observability.outputTokens,
            totalTokens: artifact.observability.totalTokens,
            estimated: false,
          }
        : undefined;
    const analytics = createSimulationStepAnalytics({
      executionMode: session.executionMode,
      providerId:
        session.executionMode === "replay"
          ? artifact?.providerId ?? "replay"
          : step.reasoningResult?.metadata.provider ?? "deterministic",
      modelId:
        session.executionMode === "replay"
          ? artifact?.modelId ?? "recorded-artifact"
          : step.reasoningResult?.metadata.model ?? "rule-reasoner-v1",
      promptVersion: step.reasoningResult?.metadata.promptVersion ?? artifact?.promptVersion,
      historicalUsage,
      historicalLatencyMs: artifact?.observability.latencyMs,
      evaluation: step.evaluationResult,
      review: session.humanReviews.find((item) => item.stepId === step.stepId),
      contextBuildMs: step.contextBuildResult.diagnostics.buildDurationMs,
      orchestrationMs: step.diagnostics.buildDurationMs,
      currentSessionCostUsd,
      baselineQuality,
      recommendationImproved: step.comparison.recommendationChanges.some((item) =>
        ["created", "escalated", "revised"].includes(item.changeType),
      ),
      catalog: developmentPricingCatalog,
      budgetPolicy: defaultSimulationBudgetPolicy,
      liveConfirmed: false,
      now: step.completedAt,
    });
    currentSessionCostUsd += analytics.cost.incrementalCostUsd;
    return { ...step, analytics };
  });
  return {
    ...session,
    simulationSteps: steps,
    analytics: aggregateSimulationAnalytics(steps.map((item) => item.analytics)),
  };
}
