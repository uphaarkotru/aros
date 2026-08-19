import Link from "next/link";
import { requireIdentity } from "@/auth/guards.server";
import {
  getOperatingPerformance,
  getOperatingPerformanceByMembership,
} from "@/db/operating-repository";
import { OperatingPage } from "@/components/operating-page";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { query } from "@/db/client";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import {
  aggregateRevenueExecutionSources,
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
  const teamMembershipIds = directReports.rows.length
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
      return { ...member, health: summarizeRevenueExecutionHealth(indicators) };
    }),
  );
  const isRsm = identity.effectiveRole === "RSM";
  return (
    <OperatingPage activeSection="performance">
      <main className="rsm-today operating-light">
        <header className="rsm-hero">
          <div>
            <span className="eyebrow">OPERATING HEALTH</span>
            <h1>Performance</h1>
            <p>
              See execution health at a glance, then open any owner for the
              evidence and actions behind the metric.
            </p>
          </div>
        </header>
        <section
          className="rsm-section performance-summary"
          aria-label="Scope performance summary"
        >
          <div className="section-heading">
            <div>
              <h2>My operating scope</h2>
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
                {isRsm ? "Performance by AE" : "Performance by team member"}
              </h2>
              <p>
                {isRsm
                  ? "Open an AE to inspect their operating metrics, leading indicators, and focused actions."
                  : "Open a team member to inspect their operating metrics and focused actions."}
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
                      className={`performance-health performance-health-${member.health.status.toLowerCase()}`}
                    >
                      <strong>{member.health.score ?? "—"}</strong>
                      <span>health</span>
                    </div>
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
                  <span className="performance-drilldown">
                    Open performance detail →
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
