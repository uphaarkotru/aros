import type { DecisionControlPolicy } from "./types";

export const defaultDecisionControlPolicy: DecisionControlPolicy = {
  minimumEvidenceReliability: 0.65,
  evidenceFreshnessDays: { "renewal-risk": 60, "expansion-opportunity": 90, "meeting-preparation": 30, "relationship-risk": 45, "forecast-risk": 30, "executive-action": 60 },
  minimumConfidence: 0.48,
  highImpactThreshold: 1_000_000,
  executiveApprovalThreshold: 10_000_000,
  financialImpactTolerance: 0.15,
  priorityWeights: { businessImpact: 0.30, urgency: 0.20, confidence: 0.15, strategicImportance: 0.15, timeSensitivity: 0.10, corroboration: 0.05, humanAttention: 0.05 },
  priorityThresholds: { critical: 85, high: 70, medium: 50 },
  deduplicationWindowDays: 14,
  minimumIndependentSources: 2,
  allowedAgents: ["Renewal Agent", "Expansion Agent", "Relationship Agent", "Forecast Agent", "Executive Agent"],
  approvalRoles: ["revenue-leader", "executive"],
  executionModes: { "renewal-risk": "approval-required", "expansion-opportunity": "draft-only", "meeting-preparation": "recommendation-only", "relationship-risk": "recommendation-only", "forecast-risk": "recommendation-only", "executive-action": "approval-required" },
};
