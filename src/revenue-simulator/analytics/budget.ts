import type { LLMUsage } from "@/domain/llm-provider/types";
import type {
  SimulationBudgetPolicy,
  SimulationBudgetResult,
  SimulationCostAnalytics,
} from "@/domain/simulation/analytics-types";

export function evaluateSimulationBudget({
  cost,
  usage,
  currentSessionCostUsd,
  policy,
  liveConfirmed,
}: {
  cost: SimulationCostAnalytics;
  usage: LLMUsage | SimulationCostAnalytics["usage"];
  currentSessionCostUsd: number;
  policy: SimulationBudgetPolicy;
  liveConfirmed: boolean;
}): SimulationBudgetResult {
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const projectedSessionCostUsd = Number(
    (currentSessionCostUsd + cost.incrementalCostUsd).toFixed(6),
  );
  if (cost.classification === "unavailable" && policy.blockWhenPricingUnavailable) {
    blockingReasons.push("Pricing is unavailable and budget policy fails closed.");
  }
  if (cost.incrementalCostUsd > policy.maximumEstimatedCostPerCallUsd) {
    blockingReasons.push("Estimated call cost exceeds the per-call budget.");
  }
  if (projectedSessionCostUsd > policy.maximumSessionCostUsd) {
    blockingReasons.push("Projected cost exceeds the session budget.");
  }
  if (usage.inputTokens > policy.maximumInputTokens) {
    blockingReasons.push("Estimated input tokens exceed the budget policy.");
  }
  if (usage.outputTokens > policy.maximumOutputTokens) {
    blockingReasons.push("Estimated output tokens exceed the budget policy.");
  }
  if (policy.requireExplicitLiveConfirmation && cost.usage.newProviderCall && !liveConfirmed) {
    blockingReasons.push("Explicit confirmation is required for a live development call.");
  }
  if (cost.usage.estimated) warnings.push("Token usage is estimated.");
  if (cost.classification === "configured-estimate") {
    warnings.push("Dollar cost uses versioned configured pricing, not provider billing data.");
  }
  return {
    allowed: blockingReasons.length === 0,
    estimatedCostUsd: cost.incrementalCostUsd,
    projectedSessionCostUsd,
    warnings,
    blockingReasons,
    policyVersion: policy.policyVersion,
  };
}
