import type {
  SimulationAnalyticsAggregate,
  SimulationStepAnalytics,
} from "@/domain/simulation/analytics-types";
import { simulationAnalyticsConfig } from "./config";
import { calculateNumericStatistics } from "./statistics";

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function aggregateSimulationAnalytics(
  analytics: Array<SimulationStepAnalytics | undefined>,
): SimulationAnalyticsAggregate {
  const steps = analytics.filter((item): item is SimulationStepAnalytics => Boolean(item));
  const latency = calculateNumericStatistics(steps.map((item) => item.latency.totalMs));
  return {
    analyticsVersion: simulationAnalyticsConfig.analyticsVersion,
    stepCount: steps.length,
    providerCallCount: steps.filter((item) => item.usage.newProviderCall).length,
    replayCallCount: steps.filter((item) => item.executionMode === "replay").length,
    totalIncrementalCostUsd: Number(
      steps.reduce((sum, item) => sum + item.cost.incrementalCostUsd, 0).toFixed(6),
    ),
    totalHistoricalReplayCostUsd: Number(
      steps
        .reduce((sum, item) => sum + (item.cost.historicalOriginalCostUsd ?? 0), 0)
        .toFixed(6),
    ),
    totalInputTokens: steps.reduce((sum, item) => sum + item.usage.inputTokens, 0),
    totalOutputTokens: steps.reduce((sum, item) => sum + item.usage.outputTokens, 0),
    totalTokens: steps.reduce((sum, item) => sum + item.usage.totalTokens, 0),
    averageQualityScore: Math.round(average(steps.map((item) => item.quality.overallScore))),
    averageGroundingScore: Math.round(
      average(steps.map((item) => item.quality.groundingScore)),
    ),
    eligibilityRate: steps.length
      ? Math.round(
          steps.filter((item) => item.quality.eligibilityScore === 100).length /
            steps.length *
            100,
        )
      : 0,
    averageLatencyMs: Math.round(latency.mean),
    latencyVariance: Number(latency.variance.toFixed(2)),
    latencyStandardDeviation: Number(latency.standardDeviation.toFixed(2)),
    minimumLatencyMs: latency.minimum,
    maximumLatencyMs: latency.maximum,
    estimatedUsageCount: steps.filter((item) => item.usage.estimated).length,
    pricingVersions: [
      ...new Set(steps.map((item) => item.cost.pricingVersion).filter(Boolean) as string[]),
    ].sort(),
  };
}
