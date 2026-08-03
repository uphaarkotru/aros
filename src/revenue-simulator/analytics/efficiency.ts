import type {
  SimulationCostAnalytics,
  SimulationEfficiencyAnalytics,
  SimulationLatencyAnalytics,
  SimulationQualityAnalytics,
} from "@/domain/simulation/analytics-types";

export function calculateCostQualityEfficiency({
  quality,
  cost,
  latency,
  baselineQuality,
  baselineLatencyMs = 0,
  recommendationImproved = false,
}: {
  quality: SimulationQualityAnalytics;
  cost: SimulationCostAnalytics;
  latency: SimulationLatencyAnalytics;
  baselineQuality: number;
  baselineLatencyMs?: number;
  recommendationImproved?: boolean;
}): SimulationEfficiencyAnalytics {
  const qualityDeltaFromBaseline = quality.overallScore - baselineQuality;
  const incrementalCost = cost.incrementalCostUsd;
  const qualityPointsPerDollar = incrementalCost > 0 ? quality.overallScore / incrementalCost : undefined;
  const costPerQualityPointGainedUsd =
    incrementalCost > 0 && qualityDeltaFromBaseline > 0
      ? incrementalCost / qualityDeltaFromBaseline
      : undefined;
  return {
    qualityPointsPerDollar,
    qualityDeltaFromBaseline,
    incrementalCostFromBaselineUsd: incrementalCost,
    costPerQualityPointGainedUsd,
    latencyDeltaFromBaselineMs: latency.totalMs - baselineLatencyMs,
    recommendationImproved,
    explanation:
      incrementalCost === 0
        ? "No incremental API cost was incurred."
        : qualityDeltaFromBaseline > 0
          ? `Quality improved ${qualityDeltaFromBaseline} point(s) for $${incrementalCost.toFixed(6)} configured cost.`
          : `The provider call cost $${incrementalCost.toFixed(6)} without a positive quality-score gain.`,
  };
}
