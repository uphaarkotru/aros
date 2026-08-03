import type { AgentEvaluationResult } from "@/domain/agent-evaluation/types";
import type {
  SimulationQualityAnalytics,
} from "@/domain/simulation/analytics-types";
import type { SimulationReview } from "@/domain/simulation/types";

function category(evaluation: AgentEvaluationResult, name: string) {
  return evaluation.categoryResults.find((item) => item.category === name)?.score ?? 0;
}

function reviewScore(review: SimulationReview | undefined) {
  if (!review) return undefined;
  return Math.round(
    (review.recommendationCorrectness +
      review.actionability +
      review.evidenceSufficiency +
      review.businessImpactAccuracy +
      review.confidenceAppropriateness +
      review.priorityAppropriateness +
      review.changeAppropriateness) /
      7 /
      5 *
      100,
  );
}

export function calculateSimulationQuality({
  evaluation,
  review,
}: {
  evaluation?: AgentEvaluationResult;
  review?: SimulationReview;
}): SimulationQualityAnalytics {
  if (!evaluation) {
    return {
      overallScore: 0,
      groundingScore: 0,
      eligibilityScore: 0,
      traceabilityScore: 0,
      recommendationQualityScore: 0,
      hallucinationFreeScore: 0,
      humanReviewScore: reviewScore(review),
    };
  }
  return {
    overallScore: evaluation.overallScore,
    groundingScore: evaluation.groundingSummary.coverageScore,
    eligibilityScore: evaluation.eligibleForGovernance ? 100 : 0,
    traceabilityScore: evaluation.traceabilitySummary.coverageScore,
    recommendationQualityScore: Math.round(
      (category(evaluation, "recommendation-specificity") +
        category(evaluation, "recommendation-actionability")) /
        2,
    ),
    hallucinationFreeScore: evaluation.hallucinationFindings.length ? 0 : 100,
    humanReviewScore: reviewScore(review),
  };
}
