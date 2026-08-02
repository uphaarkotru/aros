import type { DecisionCandidate, DecisionType, ValidationIssue, ValidationResult } from "@/domain/decisions/types";
import type { DecisionControlPolicy } from "../types";

const decisionTypes: DecisionType[] = ["renewal-risk", "expansion-opportunity", "meeting-preparation", "relationship-risk", "forecast-risk", "executive-action"];
const stringFields = ["candidateId", "accountId", "proposedCategory", "proposedTitle", "proposedSummary", "whatHappened", "whyItMatters", "recommendedAction", "responsibleAgent", "generatedAt", "reasoningSummary"] as const;
const issue = (code: string, field: string, message: string): ValidationIssue => ({ code, field, message, severity: "error" });

export function validateCandidateSchema(value: unknown, policy: DecisionControlPolicy, now: string): { candidate?: DecisionCandidate; result: ValidationResult } {
  const errors: ValidationIssue[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { result: { valid: false, errors: [issue("invalid-schema", "candidate", "Candidate must be an object.")], warnings: [], validatedAt: now } };
  const candidate = value as Partial<DecisionCandidate>;
  for (const field of stringFields) if (typeof candidate[field] !== "string" || candidate[field]?.trim() === "") errors.push(issue("required-field", field, `${field} is required.`));
  if (!decisionTypes.includes(candidate.proposedType as DecisionType)) errors.push(issue("invalid-decision-type", "proposedType", "Decision type is not supported."));
  if (!policy.allowedAgents.includes(candidate.responsibleAgent ?? "")) errors.push(issue("invalid-agent", "responsibleAgent", "Responsible agent is not allowed."));
  if (typeof candidate.proposedConfidence !== "number" || !Number.isFinite(candidate.proposedConfidence) || candidate.proposedConfidence < 0 || candidate.proposedConfidence > 1) errors.push(issue("invalid-confidence", "proposedConfidence", "Confidence must be between 0 and 1."));
  if (typeof candidate.proposedBusinessImpactValue !== "number" || !Number.isFinite(candidate.proposedBusinessImpactValue) || candidate.proposedBusinessImpactValue < 0) errors.push(issue("invalid-financial-impact", "proposedBusinessImpactValue", "Financial impact must be a nonnegative number."));
  if (!Array.isArray(candidate.evidenceIds) || candidate.evidenceIds.length === 0 || candidate.evidenceIds.some((id) => typeof id !== "string")) errors.push(issue("missing-evidence", "evidenceIds", "At least one evidence reference is required."));
  for (const field of ["generatedAt", "dueAt", "meetingTime"] as const) if (candidate[field] !== undefined && Number.isNaN(Date.parse(candidate[field] as string))) errors.push(issue("invalid-timestamp", field, `${field} must be a valid timestamp.`));
  if (!candidate.modelMetadata || candidate.modelMetadata.synthetic !== true || typeof candidate.modelMetadata.traceId !== "string") errors.push(issue("invalid-model-metadata", "modelMetadata", "Synthetic model metadata and trace ID are required."));
  const result = { valid: errors.length === 0, errors, warnings: [], validatedAt: now };
  return result.valid ? { candidate: candidate as DecisionCandidate, result } : { result };
}
