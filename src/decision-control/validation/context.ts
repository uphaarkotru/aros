import type { AccountContext } from "@/domain/accounts/types";
import type { DecisionCandidate, GovernanceFlag, ValidationIssue } from "@/domain/decisions/types";
import type { EvidenceItem, EvidenceSource } from "@/domain/evidence/types";
import type { DecisionControlPolicy } from "../types";

const authoritativeSources: EvidenceSource[] = ["salesforce", "gong", "product-usage", "support", "calendar", "contract-system"];
const error = (code: string, field: string, message: string): ValidationIssue => ({ code, field, message, severity: "error" });
const warning = (code: string, field: string, message: string): ValidationIssue => ({ code, field, message, severity: "warning" });

export function validateContext(candidate: DecisionCandidate, accounts: readonly AccountContext[], allEvidence: readonly EvidenceItem[], policy: DecisionControlPolicy, now: string) {
  const errors: ValidationIssue[] = []; const warnings: ValidationIssue[] = []; const flags: GovernanceFlag[] = [];
  const account = accounts.find((item) => item.id === candidate.accountId);
  if (!account) return { errors: [error("unknown-account", "accountId", "Referenced account does not exist.")], warnings, flags, evidence: [] as EvidenceItem[], account: undefined };
  if (account.accountStatus !== "active") errors.push(error("inactive-account", "accountId", "Account is not active."));
  if (!Number.isFinite(account.annualContractValue) || !Number.isFinite(account.openOpportunityValue)) errors.push(error("missing-authoritative-financials", "accountId", "Authoritative financial context is missing."));
  if ((account.criticalConflictCount??0)>0) { warnings.push(warning("critical-source-conflict","accountId","Authoritative account evidence has a critical unresolved conflict.")); flags.push("critical-source-conflict"); }
  if ((account.unsupportedFactCount??0)>0) { warnings.push(warning("unsupported-authoritative-fact","accountId","Some account facts have insufficient reconciliation confidence.")); flags.push("unsupported-authoritative-fact"); }
  if ((account.staleFactCount??0)>0) { warnings.push(warning("stale-account-facts","accountId","The reconciled account context contains stale facts.")); flags.push("stale-evidence"); }
  if (!account.executiveSponsor && ["renewal-risk", "executive-action"].includes(candidate.proposedType)) { warnings.push(warning("incomplete-account-context", "executiveSponsor", "Executive sponsor is not identified.")); flags.push("incomplete-account-context"); }
  const evidence: EvidenceItem[] = [];
  for (const id of candidate.evidenceIds) {
    const item = allEvidence.find((entry) => entry.id === id);
    if (!item) { errors.push(error("missing-evidence", "evidenceIds", `Evidence ${id} does not exist.`)); flags.push("unverified-evidence"); continue; }
    if (item.accountId !== candidate.accountId) { errors.push(error("evidence-account-mismatch", "evidenceIds", `Evidence ${id} belongs to another account.`)); flags.push("unverified-evidence"); continue; }
    evidence.push(item);
  }
  const freshnessMs = policy.evidenceFreshnessDays[candidate.proposedType] * 86_400_000;
  const freshEvidence = evidence.filter((item) => new Date(now).getTime() - new Date(item.observedAt).getTime() <= freshnessMs);
  if (freshEvidence.length === 0 && evidence.length) { errors.push(error("stale-evidence", "evidenceIds", "All referenced evidence is stale.")); flags.push("stale-evidence"); }
  else if (freshEvidence.length < evidence.length) { warnings.push(warning("stale-evidence", "evidenceIds", "Some referenced evidence is stale.")); flags.push("stale-evidence"); }
  if (evidence.some((item) => item.reliability < policy.minimumEvidenceReliability)) { warnings.push(warning("low-evidence-reliability", "evidenceIds", "Some evidence is below the reliability policy.")); flags.push("unverified-evidence"); }
  if (evidence.length && evidence.every((item) => item.reliability < policy.minimumEvidenceReliability)) errors.push(error("insufficient-evidence-reliability", "evidenceIds", "No evidence meets the minimum reliability policy."));
  const sources = new Set(freshEvidence.map((item) => item.source));
  if (sources.size < policy.minimumIndependentSources) { warnings.push(warning("insufficient-corroboration", "evidenceIds", "Independent corroboration is below policy.")); flags.push("insufficient-corroboration"); }
  const proposedHighImpact = candidate.proposedBusinessImpactValue >= policy.highImpactThreshold;
  if (proposedHighImpact && !freshEvidence.some((item) => authoritativeSources.includes(item.source))) errors.push(error("missing-authoritative-evidence", "evidenceIds", "High-impact decisions require an authoritative source."));
  return { account, evidence, errors, warnings, flags };
}
