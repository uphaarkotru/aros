import type { AccountContext } from "@/domain/accounts/types";
import type { AuditEvent, DecisionType, GovernedDecision, GovernanceFlag, ValidationIssue } from "@/domain/decisions/types";
import type { EvidenceItem } from "@/domain/evidence/types";

export interface DecisionControlPolicy {
  minimumEvidenceReliability: number;
  evidenceFreshnessDays: Record<DecisionType, number>;
  minimumConfidence: number;
  highImpactThreshold: number;
  executiveApprovalThreshold: number;
  financialImpactTolerance: number;
  priorityWeights: { businessImpact: number; urgency: number; confidence: number; strategicImportance: number; timeSensitivity: number; corroboration: number; humanAttention: number };
  priorityThresholds: { critical: number; high: number; medium: number };
  deduplicationWindowDays: number;
  minimumIndependentSources: number;
  allowedAgents: string[];
  approvalRoles: string[];
  executionModes: Record<DecisionType, "recommendation-only" | "draft-only" | "approval-required" | "autonomous-allowed">;
}

export interface RejectedCandidate { candidateId: string; issues: ValidationIssue[]; }
export interface ControlWarning { candidateId: string; flags: GovernanceFlag[]; messages: string[]; }
export interface DecisionControlDiagnostics { candidateCount: number; acceptedDecisionCount: number; rejectedCandidateCount: number; validationFailures: number; governanceWarnings: number; deduplicationEvents: number; impactAdjustments: number; confidenceAdjustments: number; priorityCalculations: number; }
export interface DecisionControlResult { acceptedDecisions: GovernedDecision[]; rejectedCandidates: RejectedCandidate[]; warnings: ControlWarning[]; auditEvents: AuditEvent[]; diagnostics: DecisionControlDiagnostics; }
export interface GovernDecisionCandidatesInput { candidates: readonly unknown[]; accounts: readonly AccountContext[]; evidence: readonly EvidenceItem[]; existingDecisions?: readonly GovernedDecision[]; policy: DecisionControlPolicy; now: string; }
