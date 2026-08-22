import Link from "next/link";
import { requireIdentity } from "@/auth/guards.server";
import {
  getOperatingPerformance,
  getOperatingPerformanceByMembership,
  getTeamSellingScores,
} from "@/db/operating-repository";
import { OperatingPage } from "@/components/operating-page";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { query } from "@/db/client";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import {
  aggregateRevenueExecutionSources,
  revenueExecutionIndicatorDefinition,
  summarizeRevenueExecutionHealth,
} from "@/revenue-execution-indicators/domain";

const metricValue = (value: number | null | undefined) => value ?? 0;

export default async function PerformancePage() {
  const identity = await requireIdentity();
  const currentMembership = getMembership(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  );
  const scopedMembershipIds = [
    ...new Set(
      (identity.scope?.userIds ?? [identity.user.id])
        .map((userId) =>
          getMembership(identityRepository, userId, identity.organization.id),
        )
        .filter((membership): membership is NonNullable<typeof membership> =>
          Boolean(membership),
        )
        .map((membership) => membership.id),
    ),
  ];
  const directReports = currentMembership
    ? await query(
        `SELECT r.source_membership_id AS membership_id
         FROM organization_relationships r
         JOIN organization_memberships m ON m.organization_id=r.organization_id AND m.id=r.source_membership_id
         WHERE r.organization_id=$1 AND r.target_membership_id=$2 AND r.relationship_type='REPORTS_TO' AND r.effective_to IS NULL AND m.status='ACTIVE'
         ORDER BY r.source_membership_id`,
        [identity.organization.id, currentMembership.id],
      )
    : { rows: [] };
  const isAe = identity.effectiveRole === "AE";
  const teamMembershipIds = isAe
    ? currentMembership
      ? [currentMembership.id]
      : [identity.membership.id]
    : directReports.rows.length
      ? directReports.rows.map((row) => String(row.membership_id))
      : scopedMembershipIds.filter((id) => id !== currentMembership?.id);
  const performance = await getOperatingPerformance(
    identity.organization.id,
    scopedMembershipIds.length ? scopedMembershipIds : [identity.membership.id],
  );
  const members = await getOperatingPerformanceByMembership(
    identity.organization.id,
    teamMembershipIds,
  );
  const teamSellingScores = await getTeamSellingScores(
    identity.organization.id,
    teamMembershipIds,
  );
  const membersWithHealth = await Promise.all(
    members.map(async (member) => {
      const sources = leadingIndicatorRepository
        ? await leadingIndicatorRepository.listForViewer({
            organizationId: identity.organization.id,
            membershipId: member.membershipId,
          })
        : [];
      const indicators = aggregateRevenueExecutionSources({
        organizationId: identity.organization.id,
        membershipId: member.membershipId,
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
      return {
        ...member,
        health: summarizeRevenueExecutionHealth(indicators),
        indicators,
      };
    }),
  );
  const isRsm = identity.effectiveRole === "RSM";
  return (
    <OperatingPage activeSection="performance">
      <main className="rsm-today operating-light">
        <header className="rsm-hero">
          <div>
            <span className="eyebrow">CROSS-FUNCTIONAL EXECUTION</span>
            <h1>Performance</h1>
            <p>
              Combine Leading Indicators with Team Selling Score to see where
              each owner needs evidence, coaching, and a focused next action.
            </p>
          </div>
        </header>
        <section
          className="rsm-section performance-summary"
          aria-label="Team Selling scope summary"
        >
          <div className="section-heading">
            <div>
              <h2>Operating scope</h2>
              <p>
                Rollup across the people and revenue motions currently in scope.
              </p>
            </div>
          </div>
          <div className="performance-summary-grid">
            <article>
              <strong>
                {metricValue(performance.cadence?.completed)}/
                {metricValue(performance.cadence?.total)}
              </strong>
              <span>Cadences completed</span>
            </article>
            <article>
              <strong>
                {metricValue(performance.commitments?.completed)}/
                {metricValue(performance.commitments?.total)}
              </strong>
              <span>Commitments closed</span>
            </article>
            <article>
              <strong>{metricValue(performance.commitments?.overdue)}</strong>
              <span>Overdue commitments</span>
            </article>
            <article>
              <strong>
                {metricValue(performance.interventions?.progressed)}/
                {metricValue(performance.interventions?.total)}
              </strong>
              <span>Interventions progressed</span>
            </article>
          </div>
        </section>
        <section className="rsm-section performance-team">
          <div className="section-heading">
            <div>
              <h2>
                {isAe
                  ? "My team selling score"
                  : isRsm
                    ? "Team selling by AE"
                    : "Team selling by team member"}
              </h2>
              <p>
                {isAe
                  ? "Open your own leading indicators, cross-functional coverage, and next coaching action."
                  : isRsm
                    ? "Open an AE to inspect cadence coverage, customer-signal involvement, and coaching actions."
                    : "Open a team member to inspect cadence coverage and coaching actions."}
              </p>
            </div>
            <span className="performance-count">
              {membersWithHealth.length} in scope
            </span>
          </div>
          {membersWithHealth.length ? (
            <div className="performance-member-grid">
              {membersWithHealth.map((member) => (
                <Link
                  className="performance-member-card"
                  href={`/performance/${encodeURIComponent(member.membershipId)}`}
                  key={member.membershipId}
                >
                  <div className="performance-member-heading">
                    <div>
                      <span className="eyebrow">
                        {member.roleCode ?? (isRsm ? "AE" : "REVENUE TEAM")}
                      </span>
                      <h3>{member.displayName}</h3>
                    </div>
                    <div
                      className={`performance-health performance-health-${teamSellingScores[member.membershipId]?.status.toLowerCase() ?? "critical"}`}
                    >
                      <strong>
                        {teamSellingScores[member.membershipId]?.score ?? "—"}
                      </strong>
                      <span>team selling</span>
                    </div>
                  </div>
                  <div className="team-selling-signal-row">
                    {(teamSellingScores[member.membershipId]?.signals ?? [])
                      .slice(0, 7)
                      .map((signal) => (
                        <span
                          className={`team-selling-signal team-selling-signal-${signal.score >= 80 ? "on" : signal.score >= 50 ? "watch" : "off"}`}
                          key={signal.key}
                          title={signal.detail}
                        >
                          {signal.label}
                        </span>
                      ))}
                  </div>
                  <div className="performance-leading-indicators">
                    <span className="performance-leading-indicators-label">
                      Leading indicators
                    </span>
                    {member.indicators.map((indicator) => (
                      <span
                        key={indicator.indicatorType}
                        title={indicator.rationale}
                      >
                        <small>
                          {
                            revenueExecutionIndicatorDefinition(
                              indicator.indicatorType,
                            ).label
                          }
                        </small>
                        <strong>{indicator.score ?? "—"}</strong>
                      </span>
                    ))}
                  </div>
                  <div className="performance-member-metrics">
                    <span>
                      <strong>
                        {member.cadence.completed}/{member.cadence.total}
                      </strong>{" "}
                      cadences
                    </span>
                    <span>
                      <strong>
                        {member.commitments.completed}/
                        {member.commitments.total}
                      </strong>{" "}
                      commitments
                    </span>
                    <span>
                      <strong>{member.commitments.overdue}</strong> overdue
                    </span>
                    <span>
                      <strong>
                        {member.interventions.progressed}/
                        {member.interventions.total}
                      </strong>{" "}
                      interventions
                    </span>
                  </div>
                  <span className="performance-coaching-preview">
                    {teamSellingScores[member.membershipId]
                      ?.coachingSuggestions[0] ??
                      member.indicators.find(
                        (indicator) =>
                          indicator.status === "AT_RISK" ||
                          indicator.status === "CRITICAL",
                      )?.recommendedNextAction ??
                      "Team selling coverage and leading indicators are on track."}
                  </span>
                  <span className="performance-drilldown">
                    Open Team Selling detail →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-brief">
              No team members are currently in this performance scope.
            </p>
          )}
        </section>
      </main>
    </OperatingPage>
  );
}
