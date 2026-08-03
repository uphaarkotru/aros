import type { LLMResponse, LLMUsage } from "@/domain/llm-provider/types";
import type { PromptPackage } from "@/domain/prompts/types";
import type {
  PricingCatalog,
  SimulationCostAnalytics,
  SimulationUsageAnalytics,
} from "@/domain/simulation/analytics-types";
import type { SimulationExecutionMode as ExecutionMode } from "@/domain/simulation/types";
import { simulationAnalyticsConfig } from "./config";
import { getModelPricing } from "./pricing-registry";

function roundCurrency(value: number) {
  return Number(value.toFixed(simulationAnalyticsConfig.currencyPrecision));
}

export function estimateUsageFromPrompt(promptPackage: PromptPackage): LLMUsage {
  const estimate = promptPackage.estimatedTokens;
  return {
    inputTokens: Math.max(0, estimate.totalEstimatedTokens - estimate.reservedOutputTokens),
    outputTokens: estimate.reservedOutputTokens,
    totalTokens: estimate.totalEstimatedTokens,
    estimated: true,
  };
}

function usageAnalytics(
  usage: LLMUsage | undefined,
  provenance: SimulationUsageAnalytics["provenance"],
  newProviderCall: boolean,
): SimulationUsageAnalytics {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    provenance: usage ? provenance : "none",
    estimated: usage?.estimated ?? false,
    newProviderCall,
  };
}

function pricedCost(
  usage: LLMUsage,
  inputRate: number,
  outputRate: number,
) {
  return roundCurrency(
    (usage.inputTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000,
  );
}

export function calculateLLMCost({
  executionMode,
  providerId,
  modelId,
  at,
  catalog,
  response,
  promptPackage,
  historicalUsage,
}: {
  executionMode: ExecutionMode;
  providerId: string;
  modelId: string;
  at: string;
  catalog: PricingCatalog;
  response?: LLMResponse;
  promptPackage?: PromptPackage;
  historicalUsage?: LLMUsage;
}): SimulationCostAnalytics {
  const pricing = getModelPricing({ providerId, modelId, at, catalog });
  if (executionMode === "deterministic") {
    const usage = usageAnalytics(undefined, "none", false);
    return {
      incrementalCostUsd: 0,
      classification: "zero-incremental",
      usage,
      explanation: "Deterministic reasoning made no provider API call.",
    };
  }
  if (executionMode === "replay") {
    const usage = usageAnalytics(historicalUsage, "recorded-original", false);
    const historicalOriginalCostUsd =
      pricing && historicalUsage
        ? pricedCost(
            historicalUsage,
            pricing.inputUsdPerMillionTokens,
            pricing.outputUsdPerMillionTokens,
          )
        : undefined;
    return {
      incrementalCostUsd: 0,
      historicalOriginalCostUsd,
      classification: historicalOriginalCostUsd === undefined ? "zero-incremental" : "historical-estimate",
      pricingId: pricing?.pricingId,
      pricingVersion: pricing?.version,
      usage,
      explanation:
        historicalOriginalCostUsd === undefined
          ? "Replay made no provider call; original-call pricing is unavailable."
          : "Replay incremental cost is zero; historical cost uses recorded tokens and configured pricing.",
    };
  }
  const normalizedUsage = response?.usage ?? (promptPackage ? estimateUsageFromPrompt(promptPackage) : undefined);
  const provenance = response
    ? response.usage.estimated
      ? "provider-estimated"
      : "provider-reported"
    : promptPackage
      ? "prompt-estimate"
      : "none";
  const usage = usageAnalytics(normalizedUsage, provenance, true);
  if (!pricing || !normalizedUsage) {
    return {
      incrementalCostUsd: 0,
      classification: "unavailable",
      usage,
      explanation: "Cost is unavailable because pricing or usage is missing; zero is not treated as a billed cost.",
    };
  }
  return {
    incrementalCostUsd: pricedCost(
      normalizedUsage,
      pricing.inputUsdPerMillionTokens,
      pricing.outputUsdPerMillionTokens,
    ),
    classification: "configured-estimate",
    pricingId: pricing.pricingId,
    pricingVersion: pricing.version,
    usage,
    explanation: `${response?.usage.estimated === false ? "Provider-reported" : "Estimated"} token usage priced with catalog ${catalog.catalogVersion}.`,
  };
}
