import { requireIdentity } from "@/auth/guards.server";
import { MorningBriefingDashboard } from "@/features/morning-briefing/morning-briefing-dashboard";
import { redirect } from "next/navigation";
import { revenueRepository } from "@/db/revenue-repository";
import { actionToGovernedDecision } from "@/features/morning-briefing/action-adapter";
import { cadenceRepository } from "@/db/cadence-repository";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import {
  aggregateRevenueExecutionIndicators,
  aggregateRevenueExecutionSources,
  summarizeRevenueExecutionHealth,
} from "@/revenue-execution-indicators/domain";
import { getTeamSellingScores } from "@/db/operating-repository";
import { query } from "@/db/client";

export default async function Page() {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "AE") redirect("/access-denied");

  const effectiveMembership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    accountIds = identity.scope?.accountIds ?? [];
  const allowed = new Set(accountIds);
  const [
    actions,
    organizationAccounts,
    cadences,
    leadingIndicators,
    opportunities,
  ] = await Promise.all([
    revenueRepository.listActions(identity.organization.id, accountIds),
    revenueRepository.listAccounts(identity.organization.id),
    cadenceRepository
      ? cadenceRepository.listCadences(
          identity.organization.id,
          effectiveMembership?.id ?? identity.membership.id,
        )
      : [],
    leadingIndicatorRepository && effectiveMembership
      ? leadingIndicatorRepository.listForViewer({
          organizationId: identity.organization.id,
          membershipId: effectiveMembership.id,
        })
      : [],
    query(
      `SELECT id,account_id FROM opportunities WHERE organization_id=$1 AND account_id=ANY($2::text[])`,
      [identity.organization.id, accountIds],
    ),
  ]);
  const membershipId = effectiveMembership?.id ?? identity.membership.id;
  const teamSellingScore = (
    await getTeamSellingScores(identity.organization.id, [membershipId])
  )[membershipId];
  const toSource = (indicator: (typeof leadingIndicators)[number]) => ({
    id: indicator.id,
    indicatorType: indicator.indicator_type,
    score: indicator.score,
    status: indicator.status,
    rationale: indicator.rationale,
    evidence: indicator.evidence,
    observedAt: indicator.observed_at,
    accountId: indicator.account_id ?? undefined,
    opportunityId: indicator.opportunity_id ?? undefined,
  });
  const opportunityAccountIds = new Map(
    opportunities.rows.map((opportunity) => [
      opportunity.id,
      opportunity.account_id,
    ]),
  );
  const scopedSources = leadingIndicators
    .filter(
      (indicator) => !indicator.account_id || allowed.has(indicator.account_id),
    )
    .map((indicator) => {
      const source = toSource(indicator);
      return {
        ...source,
        accountId:
          source.accountId ??
          (source.opportunityId
            ? (opportunityAccountIds.get(source.opportunityId) ?? undefined)
            : undefined),
      };
    });
  const accountRollups = organizationAccounts
    .filter((account) => allowed.has(account.id))
    .map((account) => {
      const accountIndicators = aggregateRevenueExecutionSources({
        organizationId: identity.organization.id,
        membershipId,
        accountId: account.id,
        sources: scopedSources.filter(
          (indicator) => indicator.accountId === account.id,
        ),
      });
      return {
        account,
        indicators: accountIndicators,
      };
    });
  const executionIndicators = aggregateRevenueExecutionIndicators({
    organizationId: identity.organization.id,
    membershipId,
    scopeLabel: "account",
    children: accountRollups.map(({ account, indicators }) => ({
      id: account.id,
      indicators,
    })),
  });
  const accounts = accountRollups.map(({ account, indicators }) => {
    const health = summarizeRevenueExecutionHealth(indicators);
    return {
      id: account.id,
      name: account.name,
      segment: account.segment,
      status: account.status,
      healthScore: health.score,
      healthStatus: health.status,
    };
  });
  const accountNames = new Map(
    organizationAccounts.map((account) => [account.id, account.name]),
  );
  const decisions = actions.map((action) =>
    actionToGovernedDecision(
      action,
      action.accountId
        ? (accountNames.get(action.accountId) ?? "Account")
        : "Account",
    ),
  );

  return (
    <>
      <MorningBriefingDashboard
        initialDecisions={decisions}
        assignedAccounts={accounts}
        cadences={cadences.map((cadence) => ({
          id: cadence.id,
          status: cadence.status,
          scope: cadence.scope,
          scheduledAt: cadence.scheduled_at,
          templateCode: cadence.template_code,
          templateName: cadence.template_name,
          opportunityName: cadence.opportunity_name,
          accountName: cadence.account_name,
          participantNames: cadence.participant_names,
          preparationSummary: cadence.preparation_summary,
          agendaCount: cadence.agenda_count,
          carryForwardCount: cadence.carry_forward_count,
        }))}
        executionIndicators={executionIndicators}
        executionIndicatorsTitle="My territory execution health"
        teamSellingScore={teamSellingScore}
        teamSellingScoreTitle="My team selling health"
        teamSellingScoreDescription="You do not have direct reports in this view—you are viewing your own Team Selling Score across the customer motion you manage."
        teamSellingScoreHref={`/performance/${encodeURIComponent(membershipId)}`}
        embedded
      />
    </>
  );
}
