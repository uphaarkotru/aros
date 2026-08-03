import type {
  SimulationAnalyticsComparison,
  SimulationStepAnalytics,
} from "@/domain/simulation/analytics-types";

export function compareCostQuality({
  baseline,
  candidate,
}: {
  baseline: SimulationStepAnalytics;
  candidate: SimulationStepAnalytics;
}): SimulationAnalyticsComparison {
  const qualityDelta = candidate.quality.overallScore - baseline.quality.overallScore;
  const incrementalCostDeltaUsd = Number(
    (candidate.cost.incrementalCostUsd - baseline.cost.incrementalCostUsd).toFixed(6),
  );
  const comparable = baseline.quality.overallScore > 0 && candidate.quality.overallScore > 0;
  const verdict: SimulationAnalyticsComparison["verdict"] = !comparable
    ? "incomparable"
    : qualityDelta <= 0
      ? "no-quality-gain"
      : incrementalCostDeltaUsd <= 0
        ? "better-value"
        : "higher-quality-higher-cost";
  return {
    baselineMode: baseline.executionMode,
    candidateMode: candidate.executionMode,
    qualityDelta,
    groundingDelta: candidate.quality.groundingScore - baseline.quality.groundingScore,
    eligibilityDelta: candidate.quality.eligibilityScore - baseline.quality.eligibilityScore,
    latencyDeltaMs: candidate.latency.totalMs - baseline.latency.totalMs,
    tokenDelta: candidate.usage.totalTokens - baseline.usage.totalTokens,
    incrementalCostDeltaUsd,
    recommendationQualityDelta:
      candidate.quality.recommendationQualityScore -
      baseline.quality.recommendationQualityScore,
    verdict,
    explanation: !comparable
      ? "Both runs require quality results before value can be compared."
      : qualityDelta <= 0
        ? `The additional $${Math.max(0, incrementalCostDeltaUsd).toFixed(6)} did not improve overall quality.`
        : `Quality improved ${qualityDelta} point(s) for an additional $${Math.max(0, incrementalCostDeltaUsd).toFixed(6)}.`,
  };
}
