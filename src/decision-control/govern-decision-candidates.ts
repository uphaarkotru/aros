import type { GovernedDecision, GovernanceFlag, ValidationIssue } from "@/domain/decisions/types";
import { createAuditEvent } from "./audit/create-audit-event";
import { assessConfidence } from "./confidence/assess-confidence";
import { deduplicateCandidates, type SupportedCandidate } from "./deduplication/deduplicate";
import { evaluateExecution } from "./execution-policy/evaluate-execution";
import { formatImpact, verifyFinancialImpact } from "./impact/verify-impact";
import { evaluateApproval } from "./approval-policy/evaluate-approval";
import { calculatePriority, priorityFromScore } from "./priority/calculate-priority";
import { rankDecisions } from "./ranking/rank-decisions";
import type { DecisionControlResult, GovernDecisionCandidatesInput } from "./types";
import { validateContext } from "./validation/context";
import { validateCandidateSchema } from "./validation/schema";

export function governDecisionCandidates(input: GovernDecisionCandidatesInput): DecisionControlResult {
  const { candidates, accounts, evidence, policy, now } = input;
  const rejectedCandidates: DecisionControlResult["rejectedCandidates"] = []; const warnings: DecisionControlResult["warnings"] = []; const supported: SupportedCandidate[] = [];
  let impactAdjustments = 0; let confidenceAdjustments = 0;
  for (const raw of candidates) {
    const schema = validateCandidateSchema(raw, policy, now); const rawId = raw && typeof raw === "object" && "candidateId" in raw && typeof raw.candidateId === "string" ? raw.candidateId : "unknown-candidate";
    if (!schema.candidate) { rejectedCandidates.push({ candidateId: rawId, issues: schema.result.errors }); continue; }
    const context = validateContext(schema.candidate, accounts, evidence, policy, now);
    if (!context.account || context.errors.length) { rejectedCandidates.push({ candidateId: schema.candidate.candidateId, issues: [...schema.result.errors, ...context.errors] }); continue; }
    const confidence = assessConfidence(schema.candidate, context.account, context.evidence, policy, now);
    if (confidence.finalConfidence < policy.minimumConfidence) { rejectedCandidates.push({ candidateId: schema.candidate.candidateId, issues: [{ code: "confidence-below-floor", field: "proposedConfidence", message: "Adjusted confidence is below policy minimum.", severity: "error" }] }); continue; }
    if (Math.abs(confidence.finalConfidence - schema.candidate.proposedConfidence) >= 0.01) confidenceAdjustments++;
    supported.push({ candidate: schema.candidate, evidence: context.evidence, strength: confidence.finalConfidence + context.evidence.length * 0.05 });
    if (context.warnings.length) warnings.push({ candidateId: schema.candidate.candidateId, flags: context.flags, messages: context.warnings.map((issue) => issue.message) });
  }
  const deduplicated = deduplicateCandidates(supported, policy); const accepted: GovernedDecision[] = [];
  for (const item of deduplicated.kept) {
    const candidate = item.candidate; const account = accounts.find((entry) => entry.id === candidate.accountId)!;
    const context = validateContext(candidate, accounts, item.evidence, policy, now); const impact = verifyFinancialImpact(candidate, account, policy); if (!impact.accepted) impactAdjustments++;
    const confidence = assessConfidence(candidate, account, item.evidence, policy, now); const scoring = calculatePriority(candidate, account, impact.verifiedValue, confidence, policy, now); const priority = priorityFromScore(scoring.total, policy); const approval = evaluateApproval(candidate, priority, impact.verifiedValue, policy); const execution = evaluateExecution(candidate, approval, policy);
    const flags = [...new Set<GovernanceFlag>([...context.flags, ...(!impact.accepted ? ["impact-mismatch" as const] : []), ...(confidence.finalConfidence < 0.65 ? ["low-confidence" as const] : []), ...(approval.requiredRole === "executive" ? ["executive-approval-required" as const] : []), "external-execution-blocked"])] ;
    const id = `decision-${candidate.candidateId}`; const audit = [
      createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"ai-agent",actorId:candidate.responsibleAgent,eventType:"candidate-created",timestamp:candidate.generatedAt,traceId:candidate.modelMetadata.traceId }),
      createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"decision-control",actorId:"control-layer",eventType:"validation-passed",timestamp:now,traceId:candidate.modelMetadata.traceId }),
      createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"decision-control",actorId:"control-layer",eventType:"evidence-verified",timestamp:now,traceId:candidate.modelMetadata.traceId,details:{ evidenceCount:item.evidence.length } }),
      ...(impact.accepted ? [] : [createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"decision-control" as const,actorId:"control-layer",eventType:"impact-adjusted" as const,timestamp:now,traceId:candidate.modelMetadata.traceId,details:{ proposed:impact.proposedValue,verified:impact.verifiedValue } })]),
      createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"decision-control",actorId:"control-layer",eventType:"confidence-adjusted",timestamp:now,traceId:candidate.modelMetadata.traceId,details:{ model:candidate.proposedConfidence,final:confidence.finalConfidence } }),
      createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"decision-control",actorId:"control-layer",eventType:"priority-assigned",timestamp:now,traceId:candidate.modelMetadata.traceId,details:{ priority,score:scoring.total } }),
      ...(approval.approvalRequired ? [createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"decision-control" as const,actorId:"control-layer",eventType:"approval-required" as const,timestamp:now,traceId:candidate.modelMetadata.traceId,details:{ role:approval.requiredRole } })] : []),
    ];
    const duplicate = deduplicated.merged.find((entry) => entry.keptId === candidate.candidateId); if (duplicate) { flags.push("duplicate-candidate"); audit.push(createAuditEvent({ decisionId:id,candidateId:candidate.candidateId,actorType:"decision-control",actorId:"control-layer",eventType:"duplicate-merged",timestamp:now,traceId:candidate.modelMetadata.traceId,details:{ mergedCandidateId:duplicate.mergedId } })); }
    const validationWarnings: ValidationIssue[] = context.warnings;
    accepted.push({ id,candidateId:candidate.candidateId,accountId:account.id,accountName:account.name,type:candidate.proposedType,category:candidate.proposedCategory,priority,priorityScore:scoring.total,title:candidate.proposedTitle,summary:candidate.proposedSummary,whatHappened:candidate.whatHappened,whyItMatters:candidate.whyItMatters,evidence:item.evidence,proposedBusinessImpact:candidate.proposedBusinessImpact,proposedBusinessImpactValue:candidate.proposedBusinessImpactValue,verifiedBusinessImpact:formatImpact(impact.verifiedValue,candidate.proposedType),verifiedBusinessImpactValue:impact.verifiedValue,impactVerification:impact,confidence:confidence.finalConfidence,confidenceAssessment:confidence,recommendedAction:candidate.recommendedAction,alternativeActions:candidate.alternativeActions,responsibleAgent:candidate.responsibleAgent,requiredHumanDecision:candidate.requiredHumanDecision,approvalPolicy:approval,executionPolicy:execution,status:"pending",createdAt:candidate.generatedAt,updatedAt:now,dueAt:candidate.dueAt,meetingTime:candidate.meetingTime,scoringBreakdown:scoring,validationResult:{valid:true,errors:[],warnings:validationWarnings,validatedAt:now},governanceFlags:[...new Set(flags)],auditTrail:audit });
  }
  const acceptedDecisions = rankDecisions(accepted); const rejectionAuditEvents = rejectedCandidates.map((item)=>createAuditEvent({decisionId:`rejected-${item.candidateId}`,candidateId:item.candidateId,actorType:"decision-control",actorId:"control-layer",eventType:"validation-failed",timestamp:now,traceId:`rejected-${item.candidateId}`,details:{issueCount:item.issues.length}})); const auditEvents = [...acceptedDecisions.flatMap((item) => item.auditTrail),...rejectionAuditEvents];
  return { acceptedDecisions,rejectedCandidates,warnings,auditEvents,diagnostics:{candidateCount:candidates.length,acceptedDecisionCount:acceptedDecisions.length,rejectedCandidateCount:rejectedCandidates.length,validationFailures:rejectedCandidates.reduce((sum,item)=>sum+item.issues.length,0),governanceWarnings:warnings.length,deduplicationEvents:deduplicated.merged.length,impactAdjustments,confidenceAdjustments,priorityCalculations:acceptedDecisions.length} };
}
