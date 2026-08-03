import type { PromptPackage } from "@/domain/prompts/types";
import type {
  PreRunCostEstimate,
  PricingCatalog,
  SimulationBudgetPolicy,
} from "@/domain/simulation/analytics-types";
import { calculateLLMCost, estimateUsageFromPrompt } from "./calculate-cost";
import { evaluateSimulationBudget } from "./budget";

export function createPreRunCostEstimate({
  promptPackage,
  providerId,
  modelId,
  currentSessionCostUsd,
  catalog,
  budgetPolicy,
  confirmed,
  now,
}: {
  promptPackage: PromptPackage;
  providerId: string;
  modelId: string;
  currentSessionCostUsd: number;
  catalog: PricingCatalog;
  budgetPolicy: SimulationBudgetPolicy;
  confirmed: boolean;
  now: string;
}): PreRunCostEstimate {
  const usage = estimateUsageFromPrompt(promptPackage);
  const cost = calculateLLMCost({
    executionMode: "real-provider-development",
    providerId,
    modelId,
    at: now,
    catalog,
    promptPackage,
  });
  const budget = evaluateSimulationBudget({
    cost,
    usage,
    currentSessionCostUsd,
    policy: budgetPolicy,
    liveConfirmed: confirmed,
  });
  return {
    providerId,
    modelId,
    usage,
    cost,
    budget,
    disclaimer:
      "Pre-run tokens and dollars are estimates. Final analytics prefer normalized provider-reported usage.",
  };
}
