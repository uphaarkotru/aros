import type {
  AccountDigitalTwin,
  MEDDPICCField,
  Trend,
} from "@/domain/accounts/account-digital-twin";
import type { AgentEvaluationResult } from "@/domain/agent-evaluation/types";
import type { EvaluationArtifact } from "@/domain/evaluation-artifacts/types";
import type { GovernedDecision } from "@/domain/decisions/types";
import type {
  RenewalEvidenceReference,
  RenewalHealthDriver,
  RenewalLeadingIndicator,
  RenewalMEDDPICCSection,
  RenewalNarrative,
  RenewalPlay,
  RenewalTimelineItem,
  RenewalWorkspaceMode,
  RenewalWorkspaceViewModel,
} from "@/domain/renewal-intelligence/types";
import { renewalIntelligenceConfig } from "./config";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const pretty = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const pct = (value: number) => `${Math.round(value * 100)}%`;
const asDirection = (trend: Trend): RenewalLeadingIndicator["direction"] =>
  trend;

function evidenceReferences(
  twin: AccountDigitalTwin,
): RenewalEvidenceReference[] {
  return twin.evidence.map((item) => {
    const facts =
      twin.reconciliation?.facts.filter(
        (fact) =>
          fact.lineage.sourceRecordIds.includes(item.sourceRecordId) ||
          fact.selectedFactId === item.id,
      ) ?? [];
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      source: item.source,
      timestamp: item.observedAt,
      confidence: item.reliability,
      factIds: facts.map((fact) => fact.id),
      lineageIds: facts.map((fact) => fact.lineage.lineageId),
      conflictIds: facts.flatMap((fact) => fact.conflictIds),
      freshness:
        facts[0]?.freshnessStatus ??
        (Date.parse(twin.asOf) - Date.parse(item.observedAt) > 30 * 86400000
          ? "stale"
          : "fresh"),
    };
  });
}
function evidenceFor(
  ids: string[],
  evidence: RenewalEvidenceReference[],
): RenewalEvidenceReference[] {
  return ids.map(
    (id) =>
      evidence.find((item) => item.id === id) ?? {
        id,
        title: `Trace ${id}`,
        summary: "Referenced by normalized account intelligence.",
        source: "account-context",
        timestamp: "",
        confidence: 0,
        factIds: [id],
        lineageIds: [],
        conflictIds: [],
        freshness: "unknown",
      },
  );
}
function meddpiccSection(
  field: MEDDPICCField,
  evidence: RenewalEvidenceReference[],
): RenewalMEDDPICCSection {
  const coverage = {
    confirmed: 100,
    partial: 65,
    assumed: 35,
    stale: 20,
    missing: 0,
    "not-applicable": 100,
  }[field.status];
  return {
    key: field.key,
    label: pretty(field.key),
    status: field.status,
    coverage,
    confidence: Math.round(field.confidence * 100),
    value: field.value || "Not yet validated",
    supportingEvidence: evidenceFor(field.evidenceIds, evidence),
    missingInformation: field.gaps,
    recommendedAction: field.recommendedNextStep,
  };
}
function healthDrivers(
  twin: AccountDigitalTwin,
  evidence: RenewalEvidenceReference[],
): RenewalHealthDriver[] {
  const renewal = twin.renewalProfile,
    champion = twin.stakeholderMap.champion,
    sponsor = twin.stakeholderMap.executiveSponsor,
    usage = twin.productUsage[0];
  const items: Omit<RenewalHealthDriver, "rank">[] = [
    {
      id: "security-review",
      label: "Security review",
      summary: renewal?.securityReviewStatus ?? "Security status unavailable",
      trend: renewal?.securityReviewStatus.toLowerCase().includes("stall")
        ? "declining"
        : "stable",
      confidence: Math.round(
        (evidence.find((item) => item.id.includes("security"))?.confidence ??
          0.75) * 100,
      ),
      businessImpact: `On the critical path for ${money(renewal?.annualContractValue ?? 0)} ARR`,
      evidenceIds: evidence
        .filter((item) => item.id.includes("security"))
        .map((item) => item.id),
    },
    {
      id: "executive-engagement",
      label: "Executive engagement",
      summary: sponsor
        ? `${sponsor.name} engagement is ${sponsor.engagementTrend}.`
        : "Executive sponsor is not validated.",
      trend: sponsor?.engagementTrend ?? "declining",
      confidence: Math.round(
        (evidence.find((item) => item.id.includes("sponsor"))?.confidence ??
          0.7) * 100,
      ),
      businessImpact:
        "Executive alignment affects escalation and renewal sponsorship.",
      evidenceIds: evidence
        .filter(
          (item) => item.id.includes("sponsor") || item.id.includes("email"),
        )
        .map((item) => item.id),
    },
    {
      id: "champion",
      label: "Champion strength",
      summary: champion
        ? `${champion.name} relationship is ${champion.relationshipStrength}.`
        : "No confirmed champion.",
      trend: champion?.engagementTrend ?? "declining",
      confidence: champion ? 85 : 45,
      businessImpact:
        "Champion access determines internal mobilization and decision clarity.",
      evidenceIds: champion?.sourceIds ?? [],
    },
    {
      id: "usage",
      label: "Usage momentum",
      summary: usage
        ? `${pretty(usage.usageTrend)} at ${pct(usage.adoptionRate)} adoption.`
        : "Usage unavailable.",
      trend: usage?.usageTrend ?? "unknown",
      confidence: usage ? 88 : 0,
      businessImpact: "Adoption supports renewal value realization.",
      evidenceIds: usage?.sourceRecordIds ?? [],
    },
    {
      id: "support",
      label: "Support health",
      summary: `Support health is ${renewal?.supportHealth ?? "unknown"}.`,
      trend:
        renewal?.supportHealth === "healthy"
          ? "improving"
          : renewal?.supportHealth === "at-risk" ||
              renewal?.supportHealth === "critical"
            ? "declining"
            : "stable",
      confidence: 80,
      businessImpact:
        "Unresolved support friction can weaken renewal advocacy.",
      evidenceIds: evidence
        .filter((item) => item.source === "support")
        .map((item) => item.id),
    },
    {
      id: "commercial-process",
      label: "Commercial process",
      summary: `Legal ${renewal?.legalReviewStatus ?? "unknown"}; procurement ${renewal?.procurementStatus ?? "unknown"}.`,
      trend: [renewal?.legalReviewStatus, renewal?.procurementStatus].some(
        (item) => item?.toLowerCase().includes("stall"),
      )
        ? "declining"
        : "stable",
      confidence: 78,
      businessImpact: "Paper process readiness determines on-time signature.",
      evidenceIds: evidence
        .filter((item) =>
          ["contract-system", "salesforce"].includes(item.source),
        )
        .map((item) => item.id),
    },
  ];
  const order = { declining: 0, unknown: 1, stable: 2, improving: 3 };
  return items
    .sort(
      (a, b) => order[a.trend] - order[b.trend] || b.confidence - a.confidence,
    )
    .slice(0, renewalIntelligenceConfig.driverLimit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
function leadingIndicators(
  twin: AccountDigitalTwin,
  evidence: RenewalEvidenceReference[],
): RenewalLeadingIndicator[] {
  const renewal = twin.renewalProfile,
    champion = twin.stakeholderMap.champion,
    sponsor = twin.stakeholderMap.executiveSponsor,
    usage = twin.productUsage[0],
    previous = twin.snapshotSummary.previous,
    committee = 8 - twin.stakeholderMap.missingRoles.length;
  const statusDirection = (value: string | undefined) =>
    value?.toLowerCase().includes("stall")
      ? ("declining" as const)
      : ("stable" as const);
  return [
    {
      id: "executive-engagement",
      label: "Executive Engagement",
      currentValue: sponsor
        ? `${sponsor.interactionCount30Days} interactions / 30d`
        : "No sponsor",
      previousValue: previous
        ? `${previous.relationshipScore}/100 relationship score`
        : "Unavailable",
      direction: sponsor?.engagementTrend ?? "unknown",
      confidence: sponsor ? 86 : 40,
      evidenceIds: evidence
        .filter(
          (item) => item.id.includes("sponsor") || item.id.includes("email"),
        )
        .map((item) => item.id),
      explanation: "Executive sponsorship and recent interaction frequency.",
    },
    {
      id: "champion-strength",
      label: "Champion Strength",
      currentValue: champion
        ? pretty(champion.relationshipStrength)
        : "Missing",
      previousValue: previous
        ? pretty(previous.stakeholderEngagementSummary)
        : "Unavailable",
      direction: champion?.engagementTrend ?? "unknown",
      confidence: champion ? 88 : 35,
      evidenceIds: champion?.sourceIds ?? [],
      explanation:
        "Champion confirmation, relationship strength, and engagement trend.",
    },
    {
      id: "usage-momentum",
      label: "Usage Momentum",
      currentValue: usage
        ? `${pct(usage.adoptionRate)} adoption`
        : "Unavailable",
      previousValue: previous
        ? `${previous.usageScore}/100 usage score`
        : "Unavailable",
      direction: asDirection(usage?.usageTrend ?? "unknown"),
      confidence: usage ? 90 : 0,
      evidenceIds: usage?.sourceRecordIds ?? [],
      explanation: "Current adoption and observed product-usage direction.",
    },
    {
      id: "support-health",
      label: "Support Health",
      currentValue: pretty(renewal?.supportHealth ?? "unknown"),
      previousValue: "Prior support baseline not captured",
      direction:
        renewal?.supportHealth === "healthy"
          ? "improving"
          : renewal?.supportHealth === "at-risk"
            ? "declining"
            : "stable",
      confidence: 80,
      evidenceIds: evidence
        .filter((item) => item.source === "support")
        .map((item) => item.id),
      explanation: "Renewal support health and escalation evidence.",
    },
    {
      id: "buying-committee-coverage",
      label: "Buying Committee Coverage",
      currentValue: `${committee}/8 roles covered`,
      previousValue: previous
        ? pretty(previous.stakeholderEngagementSummary)
        : "Unavailable",
      direction:
        twin.stakeholderMap.missingRoles.length > 2 ? "declining" : "stable",
      confidence: 82,
      evidenceIds: twin.stakeholders.flatMap((item) => item.sourceIds),
      explanation:
        "Validated decision roles relative to required buying roles.",
    },
    {
      id: "security-readiness",
      label: "Security Readiness",
      currentValue: renewal?.securityReviewStatus ?? "Unknown",
      previousValue: "Previous status not captured",
      direction: statusDirection(renewal?.securityReviewStatus),
      confidence: 92,
      evidenceIds: evidence
        .filter((item) => item.id.includes("security"))
        .map((item) => item.id),
      explanation: "Security-review status on the renewal critical path.",
    },
    {
      id: "legal-readiness",
      label: "Legal Readiness",
      currentValue: renewal?.legalReviewStatus ?? "Unknown",
      previousValue: "Previous status not captured",
      direction: statusDirection(renewal?.legalReviewStatus),
      confidence: 78,
      evidenceIds: evidence
        .filter((item) => item.source === "contract-system")
        .map((item) => item.id),
      explanation: "Legal-review status from commercial context.",
    },
    {
      id: "procurement-readiness",
      label: "Procurement Readiness",
      currentValue: renewal?.procurementStatus ?? "Unknown",
      previousValue: "Previous status not captured",
      direction: statusDirection(renewal?.procurementStatus),
      confidence: 78,
      evidenceIds: evidence
        .filter((item) => item.source === "salesforce")
        .map((item) => item.id),
      explanation: "Procurement status and timing readiness.",
    },
    {
      id: "technical-validation",
      label: "Technical Validation",
      currentValue: usage
        ? `${usage.activeUsers.toLocaleString()} active users`
        : "Unavailable",
      previousValue: previous
        ? `${previous.usageScore}/100 usage score`
        : "Unavailable",
      direction: asDirection(usage?.usageTrend ?? "unknown"),
      confidence: 85,
      evidenceIds: usage?.sourceRecordIds ?? [],
      explanation:
        "Observed usage and adoption as evidence of technical value.",
    },
  ];
}
function requiredParticipants(twin: AccountDigitalTwin): string[] {
  return [
    twin.stakeholderMap.executiveSponsor?.name,
    twin.stakeholderMap.champion?.name,
    "Account Executive",
    "Security Architect",
  ].filter((item): item is string => Boolean(item));
}
function recommendedPlays(
  twin: AccountDigitalTwin,
  evaluation: AgentEvaluationResult,
  evidence: RenewalEvidenceReference[],
  decisions: GovernedDecision[],
): RenewalPlay[] {
  return decisions
    .filter((item) => item.accountId === twin.accountId)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, renewalIntelligenceConfig.playLimit)
    .map((item) => ({
      id: `play-${item.id}`,
      decisionId: item.id,
      title: item.title,
      priority: item.priority,
      expectedImpact: item.verifiedBusinessImpact,
      estimatedRevenueProtected: item.verifiedBusinessImpactValue,
      requiredParticipants: requiredParticipants(twin),
      recommendedOwner: twin.identity.ownerName,
      suggestedDeadline:
        item.dueAt ??
        twin.renewalProfile?.milestoneDueAt ??
        twin.commercialProfile.renewalDate,
      supportingEvidence: evidenceFor(
        item.evidence.map((value) => value.id),
        evidence,
      ),
      reasoningSummary: item.whyItMatters,
      recommendedAction: item.recommendedAction,
      aiConfidence: Math.round(item.confidence * 100),
      evaluationScore: evaluation.overallScore,
      humanStatus: item.status,
      governedDecision: item,
    }));
}
function renewalTimeline(
  twin: AccountDigitalTwin,
  plays: RenewalPlay[],
): RenewalTimelineItem[] {
  const occurred: RenewalTimelineItem[] = twin.fullTimeline.map((item) => ({
    id: item.id,
    kind:
      item.type === "meeting"
        ? "meeting"
        : item.type === "stakeholder-change"
          ? "stakeholder-change"
          : item.category === "decisions"
            ? "risk-change"
            : "event",
    title: item.title,
    summary: item.summary,
    timestamp: item.occurredAt,
    upcoming: false,
    source: item.source,
  }));
  const milestones: RenewalTimelineItem[] = twin.renewalProfile
    ? [
        {
          id: "renewal-next-milestone",
          kind: "milestone",
          title: twin.renewalProfile.nextMilestone,
          summary: "Next validated renewal milestone.",
          timestamp: twin.renewalProfile.milestoneDueAt,
          upcoming: true,
          source: "renewal-profile",
        },
        {
          id: "renewal-date",
          kind: "milestone",
          title: "Renewal date",
          summary: `${money(twin.renewalProfile.annualContractValue)} ARR renewal.`,
          timestamp: twin.renewalProfile.renewalDate,
          upcoming: true,
          source: "contract-system",
        },
      ]
    : [];
  milestones.push(
    ...plays.map((item) => ({
      id: `deadline-${item.id}`,
      kind: "milestone" as const,
      title: `Play due: ${item.title}`,
      summary: item.recommendedAction,
      timestamp: item.suggestedDeadline,
      upcoming: true,
      source: "Decision Control",
    })),
  );
  return [...occurred, ...milestones].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
}
function executiveNarrative(
  twin: AccountDigitalTwin,
  drivers: RenewalHealthDriver[],
  plays: RenewalPlay[],
): RenewalNarrative {
  return {
    whatChanged: (twin.snapshotSummary.changes.length
      ? twin.snapshotSummary.changes.map((item) => item.summary)
      : drivers
          .filter((item) => item.trend === "declining")
          .map((item) => item.summary)
    ).slice(0, 3),
    biggestRisks: drivers
      .filter((item) => item.trend === "declining")
      .map((item) => `${item.label}: ${item.summary}`)
      .slice(0, 3),
    biggestOpportunity: (twin.expansionSignals.length
      ? twin.expansionSignals
      : [
          "Protect the current renewal by restoring executive alignment and completing the critical path.",
        ]
    ).slice(0, 3),
    whatToDoToday: plays.map((item) => item.recommendedAction).slice(0, 3),
  };
}

export function buildRenewalWorkspace({
  twin,
  evaluation,
  artifact,
  mode = "deterministic-baseline",
  decisions = twin.activeDecisions,
}: {
  twin: AccountDigitalTwin;
  evaluation: AgentEvaluationResult;
  artifact?: EvaluationArtifact;
  mode?: RenewalWorkspaceMode;
  decisions?: GovernedDecision[];
}): RenewalWorkspaceViewModel {
  if (!twin.renewalProfile) throw new Error("renewal-profile-required");
  const evidence = evidenceReferences(twin),
    drivers = healthDrivers(twin, evidence),
    sections = twin.meddpicc.fields.map((field) =>
      meddpiccSection(field, evidence),
    ),
    plays = recommendedPlays(twin, evaluation, evidence, decisions),
    top = plays[0];
  return {
    accountId: twin.accountId,
    accountName: twin.identity.name,
    ownerName: twin.identity.ownerName,
    asOf: twin.asOf,
    mode,
    modeLabel: renewalIntelligenceConfig.modeLabels[mode],
    artifactId: artifact?.artifactId,
    regressionStatus:
      artifact?.promotionDecision.outcome === "Blocked" ||
      artifact?.promotionDecision.outcome === "Rejected"
        ? "blocked"
        : artifact?.promotionDecision.outcome === "Conditionally Approved"
          ? "warning"
          : "clear",
    executiveSummary: {
      healthScore: twin.health.overallScore,
      healthStatus: twin.health.overallStatus,
      arr: twin.renewalProfile.annualContractValue,
      renewalDate: twin.renewalProfile.renewalDate,
      riskTrend: twin.health.trend,
      renewalConfidence: Math.round(
        twin.renewalProfile.renewalLikelihood * 100,
      ),
      revenueAtRisk:
        top?.estimatedRevenueProtected ??
        twin.renewalProfile.annualContractValue,
      topRecommendation:
        top?.recommendedAction ??
        twin.renewalProfile.renewalPlan[0] ??
        "Validate the renewal plan.",
      aiConfidence: top?.aiConfidence ?? 0,
      evaluationScore: evaluation.overallScore,
      humanStatus: top?.humanStatus ?? "pending",
    },
    healthDrivers: drivers,
    meddpicc: {
      coverage: twin.meddpicc.completenessScore,
      decisionConfidence: Math.round(
        sections.reduce((sum, item) => sum + item.confidence, 0) /
          sections.length,
      ),
      missingEvidenceCount: sections.reduce(
        (sum, item) => sum + item.missingInformation.length,
        0,
      ),
      sections,
    },
    leadingIndicators: leadingIndicators(twin, evidence),
    plays,
    timeline: renewalTimeline(twin, plays),
    evidence,
    narrative: executiveNarrative(twin, drivers, plays),
  };
}
