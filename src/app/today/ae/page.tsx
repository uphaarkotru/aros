import { requireIdentity } from "@/auth/guards.server";
import { MorningBriefingDashboard } from "@/features/morning-briefing/morning-briefing-dashboard";
import { redirect } from "next/navigation";
import { revenueRepository } from "@/db/revenue-repository";
import { actionToGovernedDecision } from "@/features/morning-briefing/action-adapter";
import { cadenceRepository } from "@/db/cadence-repository";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";

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
  const [actions, organizationAccounts, cadences] = await Promise.all([
    revenueRepository.listActions(identity.organization.id, accountIds),
    revenueRepository.listAccounts(identity.organization.id),
    cadenceRepository
      ? cadenceRepository.listCadences(
          identity.organization.id,
          effectiveMembership?.id ?? identity.membership.id,
        )
      : [],
  ]);
  const accounts = organizationAccounts
    .filter((account) => allowed.has(account.id))
    .map(({ id, name, segment, status }) => ({ id, name, segment, status }));
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
    />
  );
}
