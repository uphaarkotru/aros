import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { getOperatingPerformanceByMembership } from "@/db/operating-repository";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import { aggregateRevenueExecutionSources } from "@/revenue-execution-indicators/domain";
import { RevenueExecutionHealthStrip } from "@/features/morning-briefing/morning-briefing-dashboard";
import { OperatingPage } from "@/components/operating-page";
import { query } from "@/db/client";

export default async function PerformanceDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const identity = await requireIdentity();
  const { membershipId } = await params;
  const allowedMembershipIds = new Set(
    (identity.scope?.userIds ?? [identity.user.id])
      .map((userId) =>
        getMembership(identityRepository, userId, identity.organization.id),
      )
      .filter((membership): membership is NonNullable<typeof membership> =>
        Boolean(membership),
      )
      .map((membership) => membership.id),
  );
  if (!allowedMembershipIds.has(membershipId)) redirect("/access-denied");
  const member = (
    await getOperatingPerformanceByMembership(identity.organization.id, [
      membershipId,
    ])
  )[0];
  if (!member) redirect("/performance");
  const sources = leadingIndicatorRepository
    ? await leadingIndicatorRepository.listForViewer({
        organizationId: identity.organization.id,
        membershipId,
      })
    : [];
  const indicators = aggregateRevenueExecutionSources({
    organizationId: identity.organization.id,
    membershipId,
    sources: sources.map((source) => ({
      id: source.id,
      indicatorType: source.indicator_type,
      score: source.score,
      status: source.status,
      rationale: source.rationale,
      evidence: source.evidence,
      observedAt: source.observed_at,
      accountId: source.account_id ?? undefined,
      opportunityId: source.opportunity_id ?? undefined,
    })),
  });
  const recentCommitments = await query(
    `SELECT c.id,c.description,c.status,c.due_at,a.name AS account_name
     FROM commitments c
     LEFT JOIN accounts a ON a.organization_id=c.organization_id AND a.id=c.account_id
     WHERE c.organization_id=$1 AND c.owner_membership_id=$2
     ORDER BY c.due_at NULLS LAST,c.updated_at DESC
     LIMIT 6`,
    [identity.organization.id, membershipId],
  );
  return (
    <OperatingPage activeSection="performance">
      <main className="rsm-today operating-light">
        <Link className="back-link performance-back-link" href="/performance">
          ← Performance
        </Link>
        <header className="rsm-hero performance-detail-hero">
          <div>
            <span className="eyebrow">OWNER PERFORMANCE DETAIL</span>
            <h1>{member.displayName}</h1>
            <p>
              {member.roleCode ?? "Revenue team member"} · execution metrics,
              leading indicators, and the next operating focus.
            </p>
          </div>
        </header>
        <section className="rsm-section performance-detail-metrics">
          <div className="performance-summary-grid">
            <article>
              <strong>
                {member.cadence.completed}/{member.cadence.total}
              </strong>
              <span>Cadences completed</span>
            </article>
            <article>
              <strong>
                {member.commitments.completed}/{member.commitments.total}
              </strong>
              <span>Commitments closed</span>
            </article>
            <article>
              <strong>{member.commitments.overdue}</strong>
              <span>Overdue commitments</span>
            </article>
            <article>
              <strong>
                {member.interventions.progressed}/{member.interventions.total}
              </strong>
              <span>Interventions progressed</span>
            </article>
          </div>
        </section>
        <RevenueExecutionHealthStrip
          indicators={indicators}
          title={`${member.displayName}'s leading indicator health`}
          scopeLabel="their accounts"
          instanceId={membershipId}
        />
        <section className="rsm-section performance-commitments">
          <div className="section-heading">
            <div>
              <h2>Commitment detail</h2>
              <p>Open customer commitments that explain the operating score.</p>
            </div>
          </div>
          {recentCommitments.rows.length ? (
            <div className="performance-commitment-list">
              {recentCommitments.rows.map((commitment) => (
                <article key={commitment.id}>
                  <div>
                    <strong>{commitment.description}</strong>
                    <small>
                      {commitment.account_name ?? "Account context unavailable"}
                    </small>
                  </div>
                  <span>{String(commitment.status).replaceAll("_", " ")}</span>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-brief">
              No commitments are currently assigned to this owner.
            </p>
          )}
        </section>
      </main>
    </OperatingPage>
  );
}
