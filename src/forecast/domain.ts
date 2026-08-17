export const forecastCategories = [
  "PIPELINE",
  "UPSIDE",
  "BEST_CASE",
  "COMMIT",
  "CLOSED",
] as const;
export type ForecastCategory = (typeof forecastCategories)[number];
export type ArosForecastCategory = "LIKELY" | "AT_RISK" | "HIGH_RISK";
export type AssessmentConfidence = "LOW" | "MEDIUM" | "HIGH";

export const forecastExceptionTypes = [
  "SELLER_MANAGER_DISAGREEMENT",
  "SELLER_AROS_DISAGREEMENT",
  "MANAGER_AROS_DISAGREEMENT",
  "LARGE_PROBABILITY_DROP",
  "LARGE_PROBABILITY_INCREASE",
  "LATE_STAGE_EVIDENCE_GAP",
  "COMMITMENT_RISK",
  "METHODOLOGY_RISK",
  "EXECUTIVE_ENGAGEMENT_RISK",
  "SECURITY_PROCUREMENT_RISK",
  "TEAM_COVERAGE_RISK",
] as const;
export type ForecastExceptionType = (typeof forecastExceptionTypes)[number];

export interface ForecastEvidenceInput {
  sellerCategory: ForecastCategory | null;
  managerCategory: ForecastCategory | null;
  strongUsage: boolean;
  customerIntentPositive: boolean;
  economicBuyerEngaged: boolean;
  commercialProgress: boolean;
  methodologyCompleteness: number | null;
  securityOrProcurementBlocker: boolean;
  blockerDays: number;
  missedCommitments: number;
  completedCommitments: number;
  executiveEngagementDeclining: boolean;
  coverageGapCount: number;
  indicatorRiskCount: number;
  indicatorCriticalCount: number;
  activeManagerInterventions: number;
  crossFunctionalReviewCompleted: boolean;
  riskImproved: boolean;
  daysToClose: number | null;
  missingEvidence: string[];
  previousProbability?: number | null;
}

export interface ForecastReasoningResult {
  probability: number;
  confidence: AssessmentConfidence;
  arosCategory: ArosForecastCategory;
  riskScore: number;
  upsideScore: number;
  rationale: string;
  positiveEvidence: string[];
  negativeEvidence: string[];
  missingEvidence: string[];
  changeDrivers: string[];
  discrepancyTypes: ForecastExceptionType[];
  movement: number | null;
}

const clamp = (value: number) => Math.max(5, Math.min(95, Math.round(value)));

export function assessForecast(
  input: ForecastEvidenceInput,
): ForecastReasoningResult {
  let probability = 70;
  const positive: string[] = [],
    negative: string[] = [],
    discrepancies: ForecastExceptionType[] = [];
  const addPositive = (points: number, reason: string) => {
    probability += points;
    positive.push(reason);
  };
  const addNegative = (points: number, reason: string) => {
    probability -= points;
    negative.push(reason);
  };

  if (input.strongUsage) addPositive(8, "Strong product usage and adoption");
  if (input.customerIntentPositive)
    addPositive(5, "Customer intent remains positive");
  if (input.economicBuyerEngaged)
    addPositive(6, "Economic buyer engagement is confirmed");
  if (input.commercialProgress)
    addPositive(4, "Commercial process is progressing");
  if ((input.methodologyCompleteness ?? 0) >= 75)
    addPositive(4, "Methodology evidence is substantially complete");
  if (input.completedCommitments)
    addPositive(
      Math.min(4, input.completedCommitments * 2),
      `${input.completedCommitments} material commitments completed`,
    );

  if (input.securityOrProcurementBlocker) {
    addNegative(12, "Security or procurement remains unresolved");
    discrepancies.push("SECURITY_PROCUREMENT_RISK");
  }
  if (input.blockerDays >= 14)
    addNegative(
      input.blockerDays >= 21 ? 10 : 6,
      `Critical blocker open ${input.blockerDays} days`,
    );
  if (input.missedCommitments) {
    addNegative(
      Math.min(15, input.missedCommitments * 5),
      `${input.missedCommitments} material commitments missed or overdue`,
    );
    discrepancies.push("COMMITMENT_RISK");
  }
  if (input.executiveEngagementDeclining) {
    addNegative(10, "Executive engagement is declining");
    discrepancies.push("EXECUTIVE_ENGAGEMENT_RISK");
  }
  if ((input.methodologyCompleteness ?? 100) < 60) {
    addNegative(8, "Material methodology evidence is incomplete");
    discrepancies.push("METHODOLOGY_RISK");
  }
  if (input.coverageGapCount) {
    addNegative(
      Math.min(8, input.coverageGapCount * 4),
      `${input.coverageGapCount} required revenue-team coverage gaps`,
    );
    discrepancies.push("TEAM_COVERAGE_RISK");
  }
  if (input.indicatorRiskCount) {
    addNegative(
      Math.min(12, input.indicatorRiskCount * 4),
      `${input.indicatorRiskCount} leading indicators are deteriorating`,
    );
  }
  if (input.indicatorCriticalCount) {
    addNegative(
      Math.min(12, input.indicatorCriticalCount * 6),
      `${input.indicatorCriticalCount} leading indicator${input.indicatorCriticalCount === 1 ? " is" : "s are"} critical`,
    );
  }
  if (input.activeManagerInterventions)
    addNegative(4, "Manager intervention remains unresolved");
  if (input.crossFunctionalReviewCompleted && !input.riskImproved)
    addNegative(
      5,
      "Cross-functional review completed without risk improvement",
    );
  if (input.daysToClose !== null && input.daysToClose <= 45)
    addNegative(5, `Decision date is within ${input.daysToClose} days`);
  if (
    input.daysToClose !== null &&
    input.daysToClose <= 60 &&
    input.missingEvidence.length
  )
    discrepancies.push("LATE_STAGE_EVIDENCE_GAP");

  probability = clamp(probability);
  const riskScore = clamp(
      100 -
        probability +
        (input.securityOrProcurementBlocker ? 12 : 0) +
        (input.missedCommitments >= 2 ? 8 : 0),
    ),
    arosCategory: ArosForecastCategory =
      riskScore >= 48 ? "HIGH_RISK" : probability < 75 ? "AT_RISK" : "LIKELY",
    confidence: AssessmentConfidence =
      input.missingEvidence.length >= 3
        ? "LOW"
        : input.missingEvidence.length
          ? "MEDIUM"
          : "HIGH";

  if (
    input.sellerCategory &&
    input.managerCategory &&
    input.sellerCategory !== input.managerCategory
  )
    discrepancies.push("SELLER_MANAGER_DISAGREEMENT");
  if (input.sellerCategory === "COMMIT" && arosCategory !== "LIKELY")
    discrepancies.push("SELLER_AROS_DISAGREEMENT");
  if (input.managerCategory === "COMMIT" && arosCategory !== "LIKELY")
    discrepancies.push("MANAGER_AROS_DISAGREEMENT");

  const movement =
    input.previousProbability == null
      ? null
      : probability - input.previousProbability;
  if (movement !== null && movement <= -10)
    discrepancies.push("LARGE_PROBABILITY_DROP");
  if (movement !== null && movement >= 10)
    discrepancies.push("LARGE_PROBABILITY_INCREASE");

  return {
    probability,
    confidence,
    arosCategory,
    riskScore,
    upsideScore: clamp(probability + positive.length * 3 - 35),
    rationale: `${arosCategory.replaceAll("_", " ")} at ${probability}% probability. ${negative[0] ?? positive[0] ?? "Evidence is limited."}`,
    positiveEvidence: positive,
    negativeEvidence: negative,
    missingEvidence: [...input.missingEvidence],
    changeDrivers: movement
      ? [
          `${movement > 0 ? "+" : ""}${movement} probability points since the prior assessment`,
          ...negative.slice(0, 3),
        ]
      : [...negative.slice(0, 3), ...positive.slice(0, 2)],
    discrepancyTypes: [...new Set(discrepancies)],
    movement,
  };
}

export interface ForecastRollupItem {
  opportunityId: string;
  amount: number;
  sellerCategory: ForecastCategory | null;
  managerCategory: ForecastCategory | null;
  probability: number;
  arosCategory: ArosForecastCategory;
}

export function rollUpForecast(items: ForecastRollupItem[]) {
  const unique = new Map(items.map((item) => [item.opportunityId, item]));
  let sellerCommit = 0,
    managerCommit = 0,
    evidenceWeighted = 0,
    atRisk = 0,
    upside = 0;
  for (const item of unique.values()) {
    if (["COMMIT", "CLOSED"].includes(item.sellerCategory ?? ""))
      sellerCommit += item.amount;
    if (["COMMIT", "CLOSED"].includes(item.managerCategory ?? ""))
      managerCommit += item.amount;
    evidenceWeighted += item.amount * (item.probability / 100);
    if (item.arosCategory === "HIGH_RISK") atRisk += item.amount;
    if (item.arosCategory === "LIKELY" && item.sellerCategory !== "COMMIT")
      upside += item.amount;
  }
  return {
    opportunityCount: unique.size,
    sellerCommit,
    managerCommit,
    evidenceWeighted: Math.round(evidenceWeighted),
    variance: Math.round(evidenceWeighted - managerCommit),
    atRisk,
    upside,
  };
}
