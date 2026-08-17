export const indicatorTypes = [
  "EXECUTIVE_ENGAGEMENT",
  "BUYING_COMMITTEE_COVERAGE",
  "ECONOMIC_BUYER_ACCESS",
  "CUSTOMER_MEETING_HEALTH",
  "NEXT_STEP_QUALITY",
  "MUTUAL_ACTION_PLAN_PROGRESS",
  "METHODOLOGY_COMPLETENESS",
  "TECHNICAL_VALIDATION_PROGRESS",
  "SECURITY_REVIEW_PROGRESS",
  "CUSTOMER_COMMITMENT_HEALTH",
  "REVENUE_TEAM_COVERAGE",
  "BLOCKER_HEALTH",
  "DECISION_PROCESS_VALIDATION",
] as const;
export type IndicatorType = (typeof indicatorTypes)[number];

export const indicatorStatuses = [
  "HEALTHY",
  "WATCH",
  "AT_RISK",
  "CRITICAL",
  "UNKNOWN",
] as const;
export type IndicatorStatus = (typeof indicatorStatuses)[number];
export type IndicatorConfidence = "LOW" | "MEDIUM" | "HIGH";

export const indicatorStatusWeight: Record<IndicatorStatus, number> = {
  HEALTHY: 0,
  UNKNOWN: 0,
  WATCH: 1,
  AT_RISK: 2,
  CRITICAL: 3,
};

export function indicatorLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function coachingForIndicator(input: {
  indicatorType: IndicatorType;
  status: IndicatorStatus;
  evidence: string[];
}) {
  const actions: Record<IndicatorType, [string, string]> = {
    EXECUTIVE_ENGAGEMENT: [
      "Executive engagement needs attention",
      "Schedule executive technical alignment before the next customer checkpoint.",
    ],
    BUYING_COMMITTEE_COVERAGE: [
      "Buying committee coverage is incomplete",
      "Map the missing decision influence and confirm an owner for the next conversation.",
    ],
    ECONOMIC_BUYER_ACCESS: [
      "Economic-buyer access is unconfirmed",
      "Validate the economic buyer and the business outcome they will approve.",
    ],
    CUSTOMER_MEETING_HEALTH: [
      "Customer meeting health is changing",
      "Review meeting quality and agree a customer-owned next step.",
    ],
    NEXT_STEP_QUALITY: [
      "Next-step quality is weak",
      "Replace an internal task with a dated, customer-confirmed milestone.",
    ],
    MUTUAL_ACTION_PLAN_PROGRESS: [
      "Mutual action plan is slipping",
      "Reconfirm milestone owners and the next checkpoint with the customer.",
    ],
    METHODOLOGY_COMPLETENESS: [
      "Methodology evidence is incomplete",
      "Coach the opportunity team to validate the missing decision evidence.",
    ],
    TECHNICAL_VALIDATION_PROGRESS: [
      "Technical validation needs attention",
      "Align the technical owner, evidence required, and dated validation milestone.",
    ],
    SECURITY_REVIEW_PROGRESS: [
      "Security review is stalled",
      "Assign the security deliverable owner and confirm the next approval checkpoint.",
    ],
    CUSTOMER_COMMITMENT_HEALTH: [
      "Customer commitments are slipping",
      "Reconfirm the dependency, recovery date, and accountable owner.",
    ],
    REVENUE_TEAM_COVERAGE: [
      "Revenue-team coverage has a gap",
      "Review the required participation type and request human approval before adding coverage.",
    ],
    BLOCKER_HEALTH: [
      "A material blocker remains open",
      "Agree the smallest next intervention and an escalation condition.",
    ],
    DECISION_PROCESS_VALIDATION: [
      "Decision process is not validated",
      "Confirm decision criteria, process, authority, and date with the customer.",
    ],
  };
  const [title, action] = actions[input.indicatorType];
  return {
    title,
    insight: `${title} (${input.status.replaceAll("_", " ")}). ${input.evidence.join(" · ")}`,
    suggestedAction: action,
  };
}
