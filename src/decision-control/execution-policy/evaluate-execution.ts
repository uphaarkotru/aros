import type { ApprovalPolicy, DecisionCandidate, ExecutionPolicy } from "@/domain/decisions/types";
import type { DecisionControlPolicy } from "../types";

export function evaluateExecution(candidate: DecisionCandidate, approval: ApprovalPolicy, policy: DecisionControlPolicy): ExecutionPolicy {
  const configured = policy.executionModes[candidate.proposedType];
  const mode = approval.approvalRequired ? "approval-required" : configured === "autonomous-allowed" ? "draft-only" : configured;
  return { mode, allowedActions: ["simulate-execution", "prepare-draft"], blockedActions: ["send-email", "update-crm", "write-calendar", "trigger-outreach"], requiresApproval: approval.approvalRequired, reason: "External execution is blocked for this milestone; approved actions may only be simulated." };
}
