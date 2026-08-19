import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplicationShell } from "@/components/application-shell";
import { RenewalWorkspace } from "@/features/renewal-intelligence/renewal-workspace";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { revenueRepository } from "@/db/revenue-repository";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import {
  aggregateRevenueExecutionIndicators,
  deriveRevenueExecutionIndicators,
  revenueExecutionIndicatorDefinition,
} from "@/revenue-execution-indicators/domain";
import type { createCoinbaseRenewalWorkspaceFixture } from "@/data/renewal-intelligence-fixtures/coinbase";

type PersistedRenewal = ReturnType<
  typeof createCoinbaseRenewalWorkspaceFixture
>;

export default async function RenewalPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const identity = await requireIdentity();
  const { accountId } = await params;
  if (!identity.scope?.accountIds.includes(accountId))
    redirect("/access-denied");
  const twin = await revenueRepository.getTwinByAccount(
    identity.organization.id,
    accountId,
  );
  const workspace = twin?.state.renewalWorkspace as
    PersistedRenewal | undefined;
  if (!workspace) notFound();

  const membership = getMembership(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  );
  const records =
    leadingIndicatorRepository && membership
      ? await leadingIndicatorRepository.listForViewer({
          organizationId: identity.organization.id,
          membershipId: membership.id,
          accountId,
        })
      : [];
  const opportunityGroups = new Map<string, typeof records>();
  for (const record of records) {
    const key = record.opportunity_id ?? `account:${accountId}`;
    const existing = opportunityGroups.get(key) ?? [];
    existing.push(record);
    opportunityGroups.set(key, existing);
  }
  const accountIndicators = aggregateRevenueExecutionIndicators({
    organizationId: identity.organization.id,
    accountId,
    children: [...opportunityGroups.entries()].map(
      ([opportunityId, sources]) => ({
        id: opportunityId,
        indicators: deriveRevenueExecutionIndicators({
          organizationId: identity.organization.id,
          accountId,
          opportunityId: opportunityId.startsWith("account:")
            ? undefined
            : opportunityId,
          sources: sources.map((source) => ({
            id: source.id,
            indicatorType: source.indicator_type,
            score: source.score,
            status: source.status,
            rationale: source.rationale,
            evidence: source.evidence,
            observedAt: source.observed_at,
          })),
        }),
      }),
    ),
    scopeLabel: "opportunity",
  });
  const canonicalLeadingIndicators = records.length
    ? accountIndicators.map((indicator) => ({
        id: indicator.indicatorType,
        label: revenueExecutionIndicatorDefinition(indicator.indicatorType)
          .label,
        currentValue:
          indicator.score === null ? "Unknown" : `${indicator.score}/100`,
        previousValue: indicator.status.replaceAll("_", " "),
        direction:
          indicator.trend === "IMPROVING"
            ? ("improving" as const)
            : indicator.trend === "DETERIORATING"
              ? ("declining" as const)
              : indicator.trend === "UNKNOWN"
                ? ("unknown" as const)
                : ("stable" as const),
        confidence: indicator.score === null ? 0 : indicator.score,
        evidenceIds: indicator.evidence
          .map((item) => item.sourceId ?? "")
          .filter(Boolean),
        explanation: `${indicator.rationale} Next: ${indicator.recommendedNextAction}`,
      }))
    : workspace.baseline.leadingIndicators;
  const baseline = {
    ...workspace.baseline,
    leadingIndicators: canonicalLeadingIndicators,
  };
  const replayWorkspace = {
    ...workspace.replayWorkspace,
    leadingIndicators: canonicalLeadingIndicators,
  };

  return (
    <ApplicationShell
      active="accounts"
      role={identity.effectiveRole ?? undefined}
    >
      <RenewalWorkspace baseline={baseline} replay={replayWorkspace} />
      <Link className="sr-only" href="/">
        Return to Morning Briefing
      </Link>
    </ApplicationShell>
  );
}
