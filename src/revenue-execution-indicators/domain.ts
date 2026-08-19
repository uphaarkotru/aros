import type { IndicatorStatus } from "@/leading-indicators/domain";

export const revenueExecutionIndicatorTypes = [
  "CUSTOMER_ENGAGEMENT_MOMENTUM",
  "EXECUTIVE_ECONOMIC_BUYER_ENGAGEMENT",
  "NEXT_STEP_COMMITMENT_DISCIPLINE",
  "OPPORTUNITY_ACCOUNT_PROGRESSION",
  "REVENUE_TEAM_COVERAGE_COLLABORATION",
] as const;
export type RevenueExecutionIndicatorType =
  (typeof revenueExecutionIndicatorTypes)[number];
export type RevenueExecutionTrend =
  "IMPROVING" | "STABLE" | "DETERIORATING" | "UNKNOWN";

export interface RevenueExecutionEvidence {
  sourceId?: string;
  text: string;
  observedAt?: string;
}

export interface RevenueExecutionIndicator {
  organizationId: string;
  accountId?: string;
  opportunityId?: string;
  membershipId?: string;
  indicatorType: RevenueExecutionIndicatorType;
  score: number | null;
  status: IndicatorStatus;
  trend: RevenueExecutionTrend;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  rationale: string;
  evidence: RevenueExecutionEvidence[];
  benchmark: string;
  implication: string;
  recommendedNextAction: string;
  observedAt: string;
  previousScore?: number;
  changedAt?: string;
}

export type CanonicalSource = {
  id: string;
  indicatorType: string;
  score: number | null;
  status: IndicatorStatus;
  rationale: string;
  evidence: string[];
  observedAt: string;
  accountId?: string;
  opportunityId?: string;
};

const statusFor = (score: number | null): IndicatorStatus => {
  if (score === null) return "UNKNOWN";
  if (score >= 75) return "HEALTHY";
  if (score >= 60) return "WATCH";
  if (score >= 40) return "AT_RISK";
  return "CRITICAL";
};
export function summarizeRevenueExecutionHealth(
  indicators: RevenueExecutionIndicator[],
): { score: number | null; status: IndicatorStatus } {
  const scores = indicators
    .map((indicator) => indicator.score)
    .filter((value): value is number => typeof value === "number");
  const score = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : null;
  return { score, status: statusFor(score) };
}
const trendFor = (status: IndicatorStatus): RevenueExecutionTrend =>
  status === "HEALTHY"
    ? "IMPROVING"
    : status === "UNKNOWN"
      ? "UNKNOWN"
      : status === "WATCH"
        ? "STABLE"
        : "DETERIORATING";
const average = (items: CanonicalSource[]) => {
  const scored = items
    .map((item) => item.score)
    .filter((value): value is number => typeof value === "number");
  return scored.length
    ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
    : null;
};
const evidenceFor = (items: CanonicalSource[]) =>
  items.flatMap((item) =>
    item.evidence.slice(0, 3).map((text) => ({
      sourceId: item.id,
      text,
      observedAt: item.observedAt,
    })),
  );

const confidenceFor = (
  count: number,
): RevenueExecutionIndicator["confidence"] =>
  count >= 3 ? "HIGH" : count >= 1 ? "MEDIUM" : "LOW";

const definitions: Record<
  RevenueExecutionIndicatorType,
  {
    label: string;
    sourceTypes: string[];
    benchmark: string;
    implication: string;
    action: string;
  }
> = {
  CUSTOMER_ENGAGEMENT_MOMENTUM: {
    label: "Engagement",
    sourceTypes: ["CUSTOMER_MEETING_HEALTH", "BUYING_COMMITTEE_COVERAGE"],
    benchmark:
      "Healthy: meaningful customer engagement is recent and spans the buying group.",
    implication:
      "Engagement breadth and recency should support the next customer milestone.",
    action:
      "Review stakeholder recency and secure a customer-confirmed next conversation.",
  },
  EXECUTIVE_ECONOMIC_BUYER_ENGAGEMENT: {
    label: "Executive access",
    sourceTypes: ["EXECUTIVE_ENGAGEMENT", "ECONOMIC_BUYER_ACCESS"],
    benchmark:
      "Healthy: executive and economic-buyer engagement is validated within 30 days.",
    implication:
      "Executive alignment should be restored before the next critical milestone.",
    action:
      "Build an executive-engagement plan with a named sponsor and dated customer meeting.",
  },
  NEXT_STEP_COMMITMENT_DISCIPLINE: {
    label: "Commitments",
    sourceTypes: [
      "CUSTOMER_COMMITMENT_HEALTH",
      "NEXT_STEP_QUALITY",
      "MUTUAL_ACTION_PLAN_PROGRESS",
    ],
    benchmark:
      "Healthy: commitments are owned, dated, customer-confirmed, and delivered on time.",
    implication:
      "Slipping customer-owned milestones weaken confidence in forward motion.",
    action:
      "Reconfirm the dependency, recovery date, accountable owner, and evidence.",
  },
  OPPORTUNITY_ACCOUNT_PROGRESSION: {
    label: "Progression",
    sourceTypes: [
      "SECURITY_REVIEW_PROGRESS",
      "TECHNICAL_VALIDATION_PROGRESS",
      "BLOCKER_HEALTH",
      "DECISION_PROCESS_VALIDATION",
      "METHODOLOGY_COMPLETENESS",
    ],
    benchmark:
      "Healthy: substantive customer milestones progress without unresolved blockers.",
    implication:
      "The revenue motion is active, but enterprise milestones may be aging or stalled.",
    action:
      "Identify the blocked milestone and agree the smallest intervention that can move it.",
  },
  REVENUE_TEAM_COVERAGE_COLLABORATION: {
    label: "Team coverage",
    sourceTypes: ["REVENUE_TEAM_COVERAGE", "BUYING_COMMITTEE_COVERAGE"],
    benchmark:
      "Healthy: required seller, technical, customer, and executive participation is active.",
    implication:
      "Core coverage may be present while executive or technical leadership coverage remains insufficient.",
    action:
      "Review coverage gaps and request the required revenue-team participant.",
  },
};

export const isRevenueExecutionIndicatorType = (
  value: string,
): value is RevenueExecutionIndicatorType =>
  revenueExecutionIndicatorTypes.includes(
    value as RevenueExecutionIndicatorType,
  );

export const revenueExecutionIndicatorDefinition = (
  indicatorType: RevenueExecutionIndicatorType,
) => definitions[indicatorType];

function summarizeIndicator(input: {
  organizationId: string;
  indicatorType: RevenueExecutionIndicatorType;
  scores: Array<number | null>;
  rationale: string;
  evidence: RevenueExecutionEvidence[];
  observedAt: string;
  accountId?: string;
  membershipId?: string;
  scopeCount?: number;
}): RevenueExecutionIndicator {
  const scored = input.scores.filter(
    (value): value is number => typeof value === "number",
  );
  const score = scored.length
    ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
    : null;
  const status = statusFor(score);
  const definition = definitions[input.indicatorType];
  return {
    organizationId: input.organizationId,
    accountId: input.accountId,
    membershipId: input.membershipId,
    indicatorType: input.indicatorType,
    score,
    status,
    trend: trendFor(status),
    confidence: confidenceFor(scored.length),
    summary: `${definition.label} is ${status.replaceAll("_", " ").toLowerCase()}${input.scopeCount ? ` across ${input.scopeCount} scopes` : ""}.`,
    rationale: input.rationale,
    evidence: input.evidence,
    benchmark: definition.benchmark,
    implication: definition.implication,
    recommendedNextAction: definition.action,
    observedAt: input.observedAt,
  };
}

export function deriveRevenueExecutionIndicators(input: {
  organizationId: string;
  accountId?: string;
  opportunityId?: string;
  membershipId?: string;
  sources: CanonicalSource[];
  observedAt?: string;
}): RevenueExecutionIndicator[] {
  const observedAt =
    input.observedAt ??
    input.sources[0]?.observedAt ??
    new Date().toISOString();
  return revenueExecutionIndicatorTypes.map((indicatorType) => {
    const definition = definitions[indicatorType];
    const sources = input.sources.filter((source) =>
      definition.sourceTypes.includes(source.indicatorType),
    );
    const score = average(sources);
    return {
      ...summarizeIndicator({
        organizationId: input.organizationId,
        indicatorType,
        scores: sources.map((source) => source.score),
        rationale:
          score === null
            ? "Evidence is insufficient to assess this execution condition."
            : sources.map((source) => source.rationale).join(" "),
        evidence: evidenceFor(sources),
        observedAt,
        accountId: input.accountId,
        membershipId: input.membershipId,
      }),
      opportunityId: input.opportunityId,
    };
  });
}

export function aggregateRevenueExecutionIndicators(input: {
  organizationId: string;
  children: Array<{
    id: string;
    indicators: RevenueExecutionIndicator[];
  }>;
  accountId?: string;
  membershipId?: string;
  scopeLabel?: string;
}): RevenueExecutionIndicator[] {
  const observedAt =
    input.children
      .flatMap((child) => child.indicators)
      .find((item) => item.observedAt)?.observedAt ?? new Date().toISOString();
  return revenueExecutionIndicatorTypes.map((indicatorType) => {
    const children = input.children
      .map((child) =>
        child.indicators.find((item) => item.indicatorType === indicatorType),
      )
      .filter((item): item is RevenueExecutionIndicator => Boolean(item));
    const scope = input.scopeLabel ?? "scope";
    return summarizeIndicator({
      organizationId: input.organizationId,
      indicatorType,
      scores: children.map((item) => item.score),
      rationale: children.length
        ? `${children.length} ${scope}${children.length === 1 ? "" : "s"} contribute to this rollup. ${children
            .map((item) => item.rationale)
            .filter(Boolean)
            .slice(0, 3)
            .join(" ")}`
        : "Evidence is insufficient to assess this execution condition.",
      evidence: children
        .flatMap((item) => item.evidence.slice(0, 2))
        .slice(0, 6),
      observedAt,
      accountId: input.accountId,
      membershipId: input.membershipId,
      scopeCount: children.length,
    });
  });
}

export function aggregateRevenueExecutionSources(input: {
  organizationId: string;
  sources: CanonicalSource[];
  accountId?: string;
  membershipId?: string;
}): RevenueExecutionIndicator[] {
  const buildAccount = (
    accountId: string | undefined,
    sources: CanonicalSource[],
  ) => {
    const opportunities = new Map<string, CanonicalSource[]>();
    for (const source of sources) {
      const key = source.opportunityId ?? `account:${accountId ?? "scope"}`;
      const existing = opportunities.get(key) ?? [];
      existing.push(source);
      opportunities.set(key, existing);
    }
    return aggregateRevenueExecutionIndicators({
      organizationId: input.organizationId,
      accountId,
      membershipId: input.membershipId,
      scopeLabel: "opportunity",
      children: [...opportunities.entries()].map(([id, childSources]) => ({
        id,
        indicators: deriveRevenueExecutionIndicators({
          organizationId: input.organizationId,
          accountId,
          opportunityId: id.startsWith("account:") ? undefined : id,
          membershipId: input.membershipId,
          sources: childSources,
        }),
      })),
    });
  };
  if (input.accountId) return buildAccount(input.accountId, input.sources);
  const accounts = new Map<string, CanonicalSource[]>();
  for (const source of input.sources) {
    const key = source.accountId ?? "scope";
    const existing = accounts.get(key) ?? [];
    existing.push(source);
    accounts.set(key, existing);
  }
  return aggregateRevenueExecutionIndicators({
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    scopeLabel: "account",
    children: [...accounts.entries()].map(([id, sources]) => ({
      id,
      indicators: buildAccount(id === "scope" ? undefined : id, sources),
    })),
  });
}
