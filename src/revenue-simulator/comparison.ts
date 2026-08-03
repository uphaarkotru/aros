import { compareSnapshots } from "@/account-digital-twin";
import type {
  SimulationAccountState,
  SimulationStateComparison,
} from "@/domain/simulation/types";

const priorityRank = { low: 1, medium: 2, high: 3, critical: 4 } as const;

export function compareSimulationStates(
  before: SimulationAccountState,
  after: SimulationAccountState,
): SimulationStateComparison {
  const previousTwin = before.accountDigitalTwin;
  const currentTwin = after.accountDigitalTwin;
  const previousIndicators = new Map(
    before.renewalWorkspaceViewModel.leadingIndicators.map((item) => [item.id, item]),
  );
  const currentIndicators = new Map(
    after.renewalWorkspaceViewModel.leadingIndicators.map((item) => [item.id, item]),
  );
  const previousMeddpicc = new Map(
    previousTwin.meddpicc.fields.map((item) => [item.key, item]),
  );
  const currentMeddpicc = new Map(
    currentTwin.meddpicc.fields.map((item) => [item.key, item]),
  );
  const previousDecision = before.governedDecisions[0];
  const currentDecision = after.governedDecisions[0];
  const healthDelta = currentTwin.health.overallScore - previousTwin.health.overallScore;

  const leadingIndicatorChanges = [...currentIndicators.values()]
    .filter((item) => {
      const previous = previousIndicators.get(item.id);
      return (
        previous &&
        (previous.currentValue !== item.currentValue ||
          previous.direction !== item.direction ||
          previous.confidence !== item.confidence)
      );
    })
    .map((item) => {
      const previous = previousIndicators.get(item.id)!;
      return {
        indicatorId: item.id,
        label: item.label,
        previousValue: previous.currentValue,
        currentValue: item.currentValue,
        direction: item.direction,
        confidenceChange: item.confidence - previous.confidence,
        evidenceAdded: item.evidenceIds.filter(
          (id) => !previous.evidenceIds.includes(id),
        ),
        explanation: `${item.label} changed from ${previous.currentValue} to ${item.currentValue}.`,
      };
    });

  const meddpiccChanges = [...currentMeddpicc.values()]
    .filter((item) => {
      const previous = previousMeddpicc.get(item.key);
      return (
        previous &&
        (previous.status !== item.status ||
          previous.confidence !== item.confidence ||
          previous.value !== item.value)
      );
    })
    .map((item) => {
      const previous = previousMeddpicc.get(item.key)!;
      return {
        key: item.key,
        previousStatus: previous.status,
        currentStatus: item.status,
        confidenceDelta: Math.round((item.confidence - previous.confidence) * 100),
        evidenceAdded: item.evidenceIds.filter(
          (id) => !previous.evidenceIds.includes(id),
        ),
        gapsAdded: item.gaps.filter((gap) => !previous.gaps.includes(gap)),
        gapsResolved: previous.gaps.filter((gap) => !item.gaps.includes(gap)),
        previousAction: previous.recommendedNextStep,
        currentAction: item.recommendedNextStep,
      };
    });

  const recommendationChanges =
    previousDecision || currentDecision
      ? [
          {
            previousDecisionId: previousDecision?.id,
            currentDecisionId: currentDecision?.id,
            changeType: !previousDecision
              ? ("created" as const)
              : !currentDecision
                ? ("removed" as const)
                : priorityRank[currentDecision.priority] > priorityRank[previousDecision.priority]
                  ? ("escalated" as const)
                  : priorityRank[currentDecision.priority] < priorityRank[previousDecision.priority]
                    ? ("de-escalated" as const)
                    : currentDecision.recommendedAction !== previousDecision.recommendedAction
                      ? ("revised" as const)
                      : ("unchanged" as const),
            previousPriority: previousDecision?.priority,
            currentPriority: currentDecision?.priority,
            previousRecommendation: previousDecision?.recommendedAction,
            currentRecommendation: currentDecision?.recommendedAction,
            businessImpactChange:
              (currentDecision?.verifiedBusinessImpactValue ?? 0) -
              (previousDecision?.verifiedBusinessImpactValue ?? 0),
            confidenceChange: Math.round(
              ((currentDecision?.confidence ?? 0) -
                (previousDecision?.confidence ?? 0)) *
                100,
            ),
            evidenceChange:
              currentDecision?.evidence
                .map((item) => item.id)
                .filter(
                  (id) =>
                    !previousDecision?.evidence.some((item) => item.id === id),
                ) ?? [],
            explanation: !previousDecision
              ? "A governed recommendation was created."
              : !currentDecision
                ? "The prior recommendation was removed."
                : currentDecision.recommendedAction === previousDecision.recommendedAction
                  ? "Recommendation remained stable."
                  : "Recommendation was revised for the new account state.",
          },
        ]
      : [];

  const evidenceChanges = currentTwin.evidence
    .map((item) => item.id)
    .filter((id) => !previousTwin.evidence.some((item) => item.id === id));
  const timelineChanges = currentTwin.fullTimeline
    .map((item) => item.id)
    .filter((id) => !previousTwin.fullTimeline.some((item) => item.id === id));
  const conflictChanges = (currentTwin.reconciliation?.conflicts ?? [])
    .map((item) => item.id)
    .filter(
      (id) =>
        !(previousTwin.reconciliation?.conflicts ?? []).some(
          (item) => item.id === id,
        ),
    );
  const stakeholderChanges = currentTwin.stakeholders
    .filter((item) => {
      const previous = previousTwin.stakeholders.find(
        (value) => value.id === item.id,
      );
      return (
        previous &&
        (previous.isChampion !== item.isChampion ||
          previous.relationshipStrength !== item.relationshipStrength ||
          previous.engagementTrend !== item.engagementTrend ||
          previous.sentiment !== item.sentiment)
      );
    })
    .map((item) => `${item.name}: ${item.relationshipStrength}, ${item.engagementTrend}`);
  const commercialChanges = [
    ...(currentTwin.commercialProfile.annualContractValue !==
    previousTwin.commercialProfile.annualContractValue
      ? [
          `ARR ${previousTwin.commercialProfile.annualContractValue} → ${currentTwin.commercialProfile.annualContractValue}`,
        ]
      : []),
    ...(currentTwin.commercialProfile.renewalDate !==
    previousTwin.commercialProfile.renewalDate
      ? [
          `Renewal ${previousTwin.commercialProfile.renewalDate} → ${currentTwin.commercialProfile.renewalDate}`,
        ]
      : []),
  ];
  const dataQualityChanges =
    currentTwin.dataQuality.overallScore === previousTwin.dataQuality.overallScore
      ? []
      : [
          `Data quality ${previousTwin.dataQuality.overallScore} → ${currentTwin.dataQuality.overallScore}`,
        ];
  const renewalChanges = compareSnapshots(before.snapshot, after.snapshot);
  const materialChangeCount =
    leadingIndicatorChanges.length +
    meddpiccChanges.length +
    recommendationChanges.filter((item) => item.changeType !== "unchanged").length +
    evidenceChanges.length +
    conflictChanges.length +
    (healthDelta === 0 ? 0 : 1);

  return {
    healthChanges: {
      previousScore: previousTwin.health.overallScore,
      currentScore: currentTwin.health.overallScore,
      delta: healthDelta,
      previousStatus: previousTwin.health.overallStatus,
      currentStatus: currentTwin.health.overallStatus,
      changedDrivers: currentTwin.health.drivers.filter(
        (item) => !previousTwin.health.drivers.includes(item),
      ),
      explanation: `Renewal health ${healthDelta === 0 ? "held" : healthDelta > 0 ? "increased" : "decreased"} by ${Math.abs(healthDelta)} point(s).`,
    },
    renewalChanges,
    leadingIndicatorChanges,
    meddpiccChanges,
    stakeholderChanges,
    commercialChanges,
    conflictChanges,
    dataQualityChanges,
    decisionChanges: recommendationChanges.map((item) => item.explanation),
    recommendationChanges,
    evidenceChanges,
    timelineChanges,
    summary: `${materialChangeCount} material change(s); health ${previousTwin.health.overallScore} → ${currentTwin.health.overallScore}.`,
    materialChangeCount,
  };
}
