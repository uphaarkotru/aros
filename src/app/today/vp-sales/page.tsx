import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { leadershipRepository } from "@/db/leadership-repository";
import { LeadershipBriefing } from "@/features/leadership/leadership-briefing";
import { query } from "@/db/client";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import { aggregateRevenueExecutionSources } from "@/revenue-execution-indicators/domain";
import {
  averageTeamSellingScores,
  getTeamSellingScores,
} from "@/db/operating-repository";
import { redirect } from "next/navigation";
import "../leadership.css";

export default async function Page() {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "VP_SALES") redirect("/access-denied");
  const membership = getMembership(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  );
  if (!membership || !leadershipRepository) redirect("/access-denied");
  const brief = await leadershipRepository.getLeadershipBrief(
    identity.organization.id,
    membership.id,
    "VP",
  );
  const managerIds = brief.managerHealth.map(
    (manager) => manager.membership_id,
  );
  const [scopedIndicators, relationships, opportunities] = await Promise.all([
    leadingIndicatorRepository
      ? leadingIndicatorRepository.listForViewer({
          organizationId: identity.organization.id,
          membershipId: membership.id,
        })
      : Promise.resolve([]),
    query(
      `SELECT source_membership_id,target_membership_id
       FROM organization_relationships
       WHERE organization_id=$1 AND relationship_type='REPORTS_TO' AND effective_to IS NULL`,
      [identity.organization.id],
    ),
    query(
      `SELECT id,account_id,owner_membership_id
       FROM opportunities WHERE organization_id=$1`,
      [identity.organization.id],
    ),
  ]);
  const managers = new Set(managerIds);
  const parentByMembership = new Map<string, string>();
  for (const relationship of relationships.rows) {
    parentByMembership.set(
      String(relationship.source_membership_id),
      String(relationship.target_membership_id),
    );
  }
  const resolveManager = (membershipId: string | null | undefined) => {
    if (!membershipId) return null;
    let current = membershipId;
    const seen = new Set<string>();
    while (!seen.has(current)) {
      if (managers.has(current)) return current;
      seen.add(current);
      const parent = parentByMembership.get(current);
      if (!parent) return null;
      current = parent;
    }
    return null;
  };
  const managerByOpportunity = new Map<string, string>();
  const managerByAccount = new Map<string, string>();
  for (const opportunity of opportunities.rows) {
    const manager = resolveManager(opportunity.owner_membership_id);
    if (!manager) continue;
    managerByOpportunity.set(String(opportunity.id), manager);
    if (!managerByAccount.has(String(opportunity.account_id)))
      managerByAccount.set(String(opportunity.account_id), manager);
  }
  const sourcesByManager = new Map<string, typeof scopedIndicators>();
  for (const indicator of scopedIndicators) {
    const manager =
      resolveManager(indicator.membership_id) ??
      managerByOpportunity.get(String(indicator.opportunity_id)) ??
      managerByAccount.get(String(indicator.account_id));
    if (!manager) continue;
    const sources = sourcesByManager.get(manager) ?? [];
    sources.push(indicator);
    sourcesByManager.set(manager, sources);
  }
  const managerRevenueExecution = brief.managerHealth.map((manager) => ({
    membership_id: manager.membership_id,
    display_name: manager.display_name,
    indicators: aggregateRevenueExecutionSources({
      organizationId: identity.organization.id,
      sources: (sourcesByManager.get(manager.membership_id) ?? []).map(
        (indicator) => ({
          id: indicator.id,
          indicatorType: indicator.indicator_type,
          score: indicator.score,
          status: indicator.status,
          rationale: indicator.rationale,
          evidence: indicator.evidence,
          observedAt: indicator.observed_at,
          accountId: indicator.account_id ?? undefined,
          opportunityId: indicator.opportunity_id ?? undefined,
        }),
      ),
    }),
  }));
  const aeIdsByManager = new Map<string, string[]>();
  for (const relationship of relationships.rows) {
    const manager = managers.has(String(relationship.target_membership_id))
      ? String(relationship.target_membership_id)
      : null;
    if (!manager) continue;
    const aeIds = aeIdsByManager.get(manager) ?? [];
    aeIds.push(String(relationship.source_membership_id));
    aeIdsByManager.set(manager, aeIds);
  }
  const aeIds = [...new Set([...aeIdsByManager.values()].flat())];
  const aeTeamSelling = await getTeamSellingScores(
    identity.organization.id,
    aeIds,
  );
  const managerTeamSelling = Object.fromEntries(
    managerIds.flatMap((managerId) => {
      const scores = (aeIdsByManager.get(managerId) ?? [])
        .map((aeId) => aeTeamSelling[aeId])
        .filter((score): score is NonNullable<typeof score> => Boolean(score));
      const average = averageTeamSellingScores(scores);
      return average ? [[managerId, average] as const] : [];
    }),
  );
  return (
    <LeadershipBriefing
      name={identity.viewUser.firstName}
      brief={{ ...brief, managerRevenueExecution, managerTeamSelling }}
    />
  );
}
