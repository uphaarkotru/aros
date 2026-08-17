import type { ActionDecisionRecord } from "@/db/revenue-repository";
import type {
  DecisionPriority,
  DecisionStatus,
  GovernedDecision,
} from "@/domain/decisions/types";
import type { EvidenceItem } from "@/domain/evidence/types";

const status = (value: string): DecisionStatus => {
  const normalized = value.toLowerCase();
  return [
    "pending",
    "approved",
    "edited",
    "dismissed",
    "snoozed",
    "ready-for-execution",
    "executed",
    "failed",
    "expired",
  ].includes(normalized)
    ? (normalized as DecisionStatus)
    : "pending";
};

const evidence = (action: ActionDecisionRecord): EvidenceItem[] => {
  const metadata = action.metadata as Partial<GovernedDecision>;
  if (Array.isArray(metadata.evidence) && metadata.evidence.length)
    return metadata.evidence;
  return action.evidence.map((item, index) => ({
    id: `${action.id}-evidence-${index}`,
    accountId: action.accountId ?? "",
    source: "manual",
    type: "decision-evidence",
    title: typeof item === "string" ? item : "Supporting evidence",
    summary: typeof item === "string" ? item : JSON.stringify(item),
    observedAt: action.updatedAt,
    reliability: 1,
    sourceRecordId: action.id,
    metadata: {},
  }));
};

export function actionToGovernedDecision(
  action: ActionDecisionRecord,
  accountName: string,
): GovernedDecision {
  const value = action.metadata as Partial<GovernedDecision>,
    priority = (value.priority ?? "high") as DecisionPriority,
    priorityScore = value.priorityScore ?? 80,
    confidence = value.confidence ?? 0.85,
    impact = value.verifiedBusinessImpact ?? "Manager attention required";
  return {
    id: action.id,
    candidateId: value.candidateId ?? action.id,
    accountId: action.accountId ?? value.accountId ?? "",
    accountName: value.accountName ?? accountName,
    type: value.type ?? "executive-action",
    category: value.category ?? action.type,
    priority,
    priorityScore,
    title: value.title ?? action.recommendation,
    summary:
      value.summary ??
      "A governed action is ready for review in the decision queue.",
    whatHappened: value.whatHappened ?? action.recommendation,
    whyItMatters:
      value.whyItMatters ??
      "The recommended action requires a human decision before execution.",
    evidence: evidence(action),
    proposedBusinessImpact: value.proposedBusinessImpact ?? impact,
    proposedBusinessImpactValue: value.proposedBusinessImpactValue ?? 0,
    verifiedBusinessImpact: impact,
    verifiedBusinessImpactValue: value.verifiedBusinessImpactValue ?? 0,
    impactVerification: value.impactVerification ?? {
      proposedValue: 0,
      verifiedValue: 0,
      variance: 0,
      source: "persisted-action",
      accepted: true,
      explanation: "Persisted governed action awaiting human review.",
    },
    confidence,
    confidenceAssessment: value.confidenceAssessment ?? {
      modelConfidence: confidence,
      evidenceConfidence: confidence,
      contextCompleteness: confidence,
      corroborationScore: confidence,
      freshnessScore: confidence,
      finalConfidence: confidence,
      explanation: "Derived from persisted action evidence.",
    },
    recommendedAction: action.recommendation,
    alternativeActions: value.alternativeActions ?? [],
    responsibleAgent: value.responsibleAgent ?? "AROS Orchestration",
    requiredHumanDecision: value.requiredHumanDecision ?? true,
    approvalPolicy: value.approvalPolicy ?? {
      approvalRequired: true,
      requiredRole: "Authorized revenue owner",
      minimumApprovers: 1,
      reason: "Human approval is required before execution.",
      allowSelfApproval: true,
      escalationPath: [],
    },
    executionPolicy: value.executionPolicy ?? {
      mode: "approval-required",
      allowedActions: [],
      blockedActions: ["external-autonomous-execution"],
      requiresApproval: true,
      reason: "Human approval is required.",
    },
    status: status(action.status),
    createdAt: value.createdAt ?? action.createdAt,
    updatedAt: action.updatedAt,
    dueAt: value.dueAt,
    meetingTime: value.meetingTime,
    scoringBreakdown: value.scoringBreakdown ?? {
      businessImpact: priorityScore,
      urgency: priorityScore,
      confidence: confidence * 100,
      strategicImportance: priorityScore,
      timeSensitivity: priorityScore,
      corroboration: confidence * 100,
      humanAttention: priorityScore,
      total: priorityScore,
    },
    validationResult: value.validationResult ?? {
      valid: true,
      errors: [],
      warnings: [],
      validatedAt: action.updatedAt,
    },
    governanceFlags: value.governanceFlags ?? [],
    auditTrail: value.auditTrail ?? [],
  };
}
