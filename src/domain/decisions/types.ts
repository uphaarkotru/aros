import type { EvidenceItem } from "@/domain/evidence/types";

export type DecisionType = "renewal-risk" | "expansion-opportunity" | "meeting-preparation" | "relationship-risk" | "forecast-risk" | "executive-action";
export type DecisionPriority = "critical" | "high" | "medium" | "low";
export type DecisionStatus = "pending" | "approved" | "edited" | "dismissed" | "snoozed" | "ready-for-execution" | "executed" | "failed" | "expired";
export type GovernanceFlag = "unverified-evidence" | "impact-mismatch" | "low-confidence" | "stale-evidence" | "insufficient-corroboration" | "duplicate-candidate" | "executive-approval-required" | "external-execution-blocked" | "incomplete-account-context" | "critical-source-conflict" | "unsupported-authoritative-fact";
export type ActorType = "ai-agent" | "decision-control" | "human" | "system";
export type AuditEventType = "candidate-created" | "validation-passed" | "validation-failed" | "evidence-verified" | "impact-adjusted" | "confidence-adjusted" | "priority-assigned" | "duplicate-merged" | "approval-required" | "approved" | "edited" | "dismissed" | "snoozed" | "ready-for-execution" | "executed" | "execution-failed";

export interface ModelMetadata {
  provider: string;
  model: string;
  promptVersion: string;
  responseVersion: string;
  generatedAt: string;
  latencyMs?: number;
  tokenUsage?: number;
  traceId: string;
  synthetic: true;
}

export type DecisionClaimType = "account-identity" | "financial-impact" | "date" | "stakeholder" | "relationship" | "product-usage" | "renewal" | "opportunity" | "forecast" | "meeting" | "recommendation-rationale" | "risk" | "qualification" | "summary";
export type DecisionClaimCertainty = "observed" | "resolved" | "corroborated" | "inferred" | "disputed" | "uncertain";
export interface DecisionClaim {
  claimId: string;
  claimType: DecisionClaimType;
  text: string;
  importance: "critical" | "high" | "medium" | "low";
  factIds: string[];
  evidenceIds: string[];
  conflictIds: string[];
  lineageIds: string[];
  certainty: DecisionClaimCertainty;
  sourceContextSection: string;
}

export interface DecisionContextMetadata {
  contextId: string;
  contextVersion: string;
  taskId: string;
  requestId: string;
  traceId: string;
  outputSchemaVersion: string;
}

export interface DecisionCandidate {
  candidateId: string;
  accountId: string;
  proposedType: DecisionType;
  proposedCategory: string;
  proposedTitle: string;
  proposedSummary: string;
  whatHappened: string;
  whyItMatters: string;
  evidenceIds: string[];
  factIds?: string[];
  proposedBusinessImpact: string;
  proposedBusinessImpactValue: number;
  proposedConfidence: number;
  recommendedAction: string;
  alternativeActions: string[];
  responsibleAgent: string;
  requiredHumanDecision: boolean;
  generatedAt: string;
  dueAt?: string;
  meetingTime?: string;
  modelMetadata: ModelMetadata;
  reasoningSummary: string;
  claimReferences?: DecisionClaim[];
  contextMetadata?: DecisionContextMetadata;
}

export interface ValidationIssue { code: string; field: string; message: string; severity: "error" | "warning"; }
export interface ValidationResult { valid: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[]; validatedAt: string; }
export interface ImpactVerificationResult { proposedValue: number; verifiedValue: number; variance: number; source: string; accepted: boolean; explanation: string; }
export interface ConfidenceAssessment { modelConfidence: number; evidenceConfidence: number; contextCompleteness: number; corroborationScore: number; freshnessScore: number; finalConfidence: number; explanation: string; }
export interface ScoringBreakdown { businessImpact: number; urgency: number; confidence: number; strategicImportance: number; timeSensitivity: number; corroboration: number; humanAttention: number; total: number; }
export interface ApprovalPolicy { approvalRequired: boolean; requiredRole: string; minimumApprovers: number; reason: string; allowSelfApproval: boolean; escalationPath: string[]; }
export type ExecutionMode = "recommendation-only" | "draft-only" | "approval-required" | "autonomous-allowed";
export interface ExecutionPolicy { mode: ExecutionMode; allowedActions: string[]; blockedActions: string[]; requiresApproval: boolean; reason: string; }
export interface AuditEvent { id: string; decisionId: string; candidateId: string; actorType: ActorType; actorId: string; eventType: AuditEventType; timestamp: string; details: Record<string, string | number | boolean>; traceId: string; }

export interface GovernedDecision {
  id: string; candidateId: string; accountId: string; accountName: string; type: DecisionType; category: string;
  priority: DecisionPriority; priorityScore: number; title: string; summary: string; whatHappened: string; whyItMatters: string;
  evidence: EvidenceItem[]; proposedBusinessImpact: string; proposedBusinessImpactValue: number; verifiedBusinessImpact: string;
  verifiedBusinessImpactValue: number; impactVerification: ImpactVerificationResult; confidence: number;
  confidenceAssessment: ConfidenceAssessment; recommendedAction: string; alternativeActions: string[]; responsibleAgent: string;
  requiredHumanDecision: boolean; approvalPolicy: ApprovalPolicy; executionPolicy: ExecutionPolicy; status: DecisionStatus;
  createdAt: string; updatedAt: string; dueAt?: string; meetingTime?: string; scoringBreakdown: ScoringBreakdown;
  validationResult: ValidationResult; governanceFlags: GovernanceFlag[]; auditTrail: AuditEvent[];
}

export interface HumanDecisionState {
  status: DecisionStatus;
  editedRecommendation?: string;
  approvedBy?: string; approvedAt?: string; dismissedBy?: string; dismissedAt?: string; dismissalReason?: string;
  snoozedUntil?: string; executionRequestedAt?: string; executedAt?: string; auditEvents: AuditEvent[];
}
