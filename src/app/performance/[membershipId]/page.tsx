import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import {
  averageTeamSellingScores,
  getOperatingPerformanceByMembership,
  getTeamSellingScores,
} from "@/db/operating-repository";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import { aggregateRevenueExecutionSources } from "@/revenue-execution-indicators/domain";
import {
  RevenueExecutionHealthStrip,
  TeamSellingHealthCard,
} from "@/features/morning-briefing/morning-briefing-dashboard";
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
  const ownTeamSelling = (
    await getTeamSellingScores(identity.organization.id, [membershipId])
  )[membershipId];
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
  const directReports =
    member.roleCode === "RSM"
      ? await query(
          `SELECT source_membership_id AS membership_id
           FROM organization_relationships
           WHERE organization_id=$1 AND target_membership_id=$2
             AND relationship_type='REPORTS_TO' AND effective_to IS NULL`,
          [identity.organization.id, membershipId],
        )
      : { rows: [] };
  const reportIds = directReports.rows.map((row) => String(row.membership_id));
  const reportMembers = reportIds.length
    ? await getOperatingPerformanceByMembership(
        identity.organization.id,
        reportIds,
      )
    : [];
  const reportTeamSelling = await getTeamSellingScores(
    identity.organization.id,
    reportIds,
  );
  const reportIndicators = await Promise.all(
    reportMembers.map(async (report) => {
      const reportSources = leadingIndicatorRepository
        ? await leadingIndicatorRepository.listForViewer({
            organizationId: identity.organization.id,
            membershipId: report.membershipId,
          })
        : [];
      return {
        report,
        indicators: aggregateRevenueExecutionSources({
          organizationId: identity.organization.id,
          membershipId: report.membershipId,
          sources: reportSources.map((source) => ({
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
        }),
      };
    }),
  );
  const teamSelling =
    member.roleCode === "RSM"
      ? (averageTeamSellingScores(
          reportIds
            .map((reportId) => reportTeamSelling[reportId])
            .filter((score): score is NonNullable<typeof score> =>
              Boolean(score),
            ),
        ) ?? ownTeamSelling)
      : ownTeamSelling;
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
            <span className="eyebrow">PERFORMANCE DETAIL</span>
            <h1>{member.displayName}</h1>
            <p>
              {member.roleCode ?? "Revenue team member"} · cross-functional
              cadence coverage, customer-signal involvement, and coaching focus.
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
        {teamSelling && (
          <section className="rsm-section team-selling-detail">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TEAM SELLING SCORE</span>
                <h2>
                  {teamSelling.score}/100 ·{" "}
                  {teamSelling.status.replaceAll("_", " ")}
                </h2>
                <p>
                  Coverage is based on recent cross-functional cadences and the
                  internal stakeholders brought into customer signals.
                </p>
              </div>
            </div>
            <div className="team-selling-detail-grid">
              {teamSelling.signals.map((signal) => (
                <article key={signal.key}>
                  <div>
                    <strong>{signal.label}</strong>
                    <span>{signal.score}/100</span>
                  </div>
                  <p>{signal.detail}</p>
                  {signal.score < 80 && (
                    <small>{signal.coachingSuggestion}</small>
                  )}
                </article>
              ))}
            </div>
            <div className="team-selling-coaching">
              <strong>Coaching suggestions</strong>
              {teamSelling.coachingSuggestions.length ? (
                <ul>
                  {teamSelling.coachingSuggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  Cross-functional coverage is healthy. Keep the current cadence
                  rhythm and continue connecting internal experts to customer
                  milestones.
                </p>
              )}
            </div>
          </section>
        )}
        <RevenueExecutionHealthStrip
          indicators={indicators}
          title={`${member.displayName}'s leading indicator health`}
          scopeLabel="their accounts"
          instanceId={membershipId}
        />
        {reportIndicators.length ? (
          <section className="rsm-section performance-reporting-team">
            <div className="section-heading">
              <div>
                <span className="eyebrow">REPORTING TEAM</span>
                <h2>AE-level execution detail</h2>
                <p>
                  RSM scores are rolled up from these AEs. Open an AE to see the
                  underlying leading indicators and team-selling evidence.
                </p>
              </div>
            </div>
            <div className="performance-reporting-list">
              {reportIndicators.map(({ report, indicators: reportHealth }) => {
                const score = reportTeamSelling[report.membershipId];
                return (
                  <article
                    className="performance-reporting-card"
                    key={report.membershipId}
                  >
                    <div className="performance-reporting-card-heading">
                      <div>
                        <span className="eyebrow">ACCOUNT EXECUTIVE</span>
                        <h3>{report.displayName}</h3>
                        <p>
                          {report.roleCode ?? "AE"} · open the full operating
                          detail for evidence and coaching actions.
                        </p>
                      </div>
                      <Link
                        className="open-arrow"
                        href={`/performance/${encodeURIComponent(report.membershipId)}`}
                      >
                        Open AE detail →
                      </Link>
                    </div>
                    <RevenueExecutionHealthStrip
                      indicators={reportHealth}
                      title={`${report.displayName}'s revenue execution health`}
                      scopeLabel="their accounts"
                      instanceId={report.membershipId}
                    />
                    {score ? (
                      <TeamSellingHealthCard
                        compact
                        score={score}
                        title={`${report.displayName}'s team selling health`}
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
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
