import type { LLMUsage } from "@/domain/llm-provider/types";

export type UsageProvenance =
  | "provider-reported"
  | "provider-estimated"
  | "prompt-estimate"
  | "recorded-original"
  | "none";
export type CostClassification =
  | "zero-incremental"
  | "configured-estimate"
  | "historical-estimate"
  | "unavailable";

export interface ModelPricingDefinition {
  pricingId: string;
  providerId: string;
  modelId: string;
  currency: "USD";
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  effectiveFrom: string;
  effectiveTo?: string;
  version: string;
  source: "development-configuration" | "synthetic";
  notes: string[];
}

export interface PricingCatalog {
  catalogVersion: string;
  prices: readonly ModelPricingDefinition[];
}

export interface SimulationUsageAnalytics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  provenance: UsageProvenance;
  estimated: boolean;
  newProviderCall: boolean;
}

export interface SimulationCostAnalytics {
  incrementalCostUsd: number;
  historicalOriginalCostUsd?: number;
  classification: CostClassification;
  pricingId?: string;
  pricingVersion?: string;
  usage: SimulationUsageAnalytics;
  explanation: string;
}

export interface SimulationLatencyAnalytics {
  contextBuildMs: number;
  providerMs: number;
  evaluationMs: number;
  orchestrationMs: number;
  totalMs: number;
  retryCount: number;
  historicalProviderMs?: number;
}

export interface SimulationQualityAnalytics {
  overallScore: number;
  groundingScore: number;
  eligibilityScore: number;
  traceabilityScore: number;
  recommendationQualityScore: number;
  hallucinationFreeScore: number;
  humanReviewScore?: number;
}

export interface SimulationEfficiencyAnalytics {
  qualityPointsPerDollar?: number;
  qualityDeltaFromBaseline: number;
  incrementalCostFromBaselineUsd: number;
  costPerQualityPointGainedUsd?: number;
  latencyDeltaFromBaselineMs: number;
  recommendationImproved: boolean;
  explanation: string;
}

export interface SimulationBudgetPolicy {
  policyVersion: string;
  maximumEstimatedCostPerCallUsd: number;
  maximumSessionCostUsd: number;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  requireExplicitLiveConfirmation: boolean;
  blockWhenPricingUnavailable: boolean;
}

export interface SimulationBudgetResult {
  allowed: boolean;
  estimatedCostUsd: number;
  projectedSessionCostUsd: number;
  warnings: string[];
  blockingReasons: string[];
  policyVersion: string;
}

export interface SimulationStepAnalytics {
  analyticsVersion: string;
  executionMode: "deterministic" | "replay" | "real-provider-development";
  providerId: string;
  modelId: string;
  promptVersion?: string;
  usage: SimulationUsageAnalytics;
  cost: SimulationCostAnalytics;
  latency: SimulationLatencyAnalytics;
  quality: SimulationQualityAnalytics;
  efficiency: SimulationEfficiencyAnalytics;
  budget: SimulationBudgetResult;
  calculatedAt: string;
}

export interface SimulationAnalyticsAggregate {
  analyticsVersion: string;
  stepCount: number;
  providerCallCount: number;
  replayCallCount: number;
  totalIncrementalCostUsd: number;
  totalHistoricalReplayCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  averageQualityScore: number;
  averageGroundingScore: number;
  eligibilityRate: number;
  averageLatencyMs: number;
  latencyVariance: number;
  latencyStandardDeviation: number;
  minimumLatencyMs: number;
  maximumLatencyMs: number;
  estimatedUsageCount: number;
  pricingVersions: string[];
}

export interface PreRunCostEstimate {
  providerId: string;
  modelId: string;
  usage: LLMUsage;
  cost: SimulationCostAnalytics;
  budget: SimulationBudgetResult;
  disclaimer: string;
}

export interface SimulationAnalyticsComparison {
  baselineMode: SimulationStepAnalytics["executionMode"];
  candidateMode: SimulationStepAnalytics["executionMode"];
  qualityDelta: number;
  groundingDelta: number;
  eligibilityDelta: number;
  latencyDeltaMs: number;
  tokenDelta: number;
  incrementalCostDeltaUsd: number;
  recommendationQualityDelta: number;
  verdict: "better-value" | "higher-quality-higher-cost" | "no-quality-gain" | "incomparable";
  explanation: string;
}
