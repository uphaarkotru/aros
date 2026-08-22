import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { DecisionApprove } from "./decision-approve";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { query } from "@/db/client";
import {
  EvidencePanel,
  RevenueImpactBadge,
  RiskIndicator,
} from "@/components/revenue-operating";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import { aggregateRevenueExecutionSources } from "@/revenue-execution-indicators/domain";
import {
  RevenueExecutionHealthStrip,
  TeamSellingHealthCard,
} from "@/features/morning-briefing/morning-briefing-dashboard";
import { getTeamSellingScores } from "@/db/operating-repository";
const money = (value: number | null) =>
  value
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value)
    : "Revenue at risk";
export default async function Page() {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "RSM") redirect("/access-denied");
  if (!cadenceRepository)
    return (
      <main className="rsm-today">
        <h1>RSM Today unavailable</h1>
      </main>
    );
  const effectiveMembership = getMembership(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  );
  await cadenceRepository.refreshManagerInterventions(
    identity.organization.id,
    effectiveMembership?.id ?? identity.membership.id,
  );
  const brief = await cadenceRepository.getRsmBrief(
      identity.organization.id,
      effectiveMembership?.id ?? identity.membership.id,
    ),
    exposure = brief.interventions.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
  const scopedIndicators =
    leadingIndicatorRepository && effectiveMembership
      ? await leadingIndicatorRepository.listForViewer({
          organizationId: identity.organization.id,
          membershipId: effectiveMembership.id,
        })
      : [];
  const ownership = await query(
    `SELECT id,account_id,owner_membership_id FROM opportunities WHERE organization_id=$1`,
    [identity.organization.id],
  );
  const ownerByOpportunity = new Map<string, string>();
  const ownersByAccount = new Map<string, string[]>();
  for (const opportunity of ownership.rows) {
    if (opportunity.owner_membership_id)
      ownerByOpportunity.set(opportunity.id, opportunity.owner_membership_id);
    if (opportunity.owner_membership_id) {
      const owners = ownersByAccount.get(opportunity.account_id) ?? [];
      if (!owners.includes(opportunity.owner_membership_id))
        owners.push(opportunity.owner_membership_id);
      ownersByAccount.set(opportunity.account_id, owners);
    }
  }
  const directReportMemberships = new Set(
    brief.reports.map((report) => report.membership_id),
  );
  const executionByAe = brief.reports.map((report) => {
    const sources = scopedIndicators
      .filter((indicator) => {
        const ownerMembership =
          (indicator.membership_id &&
            directReportMemberships.has(indicator.membership_id) &&
            indicator.membership_id) ||
          (indicator.opportunity_id &&
            ownerByOpportunity.get(indicator.opportunity_id)) ||
          (indicator.account_id &&
            ownersByAccount.get(indicator.account_id)?.[0]);
        return ownerMembership === report.membership_id;
      })
      .map((indicator) => ({
        id: indicator.id,
        indicatorType: indicator.indicator_type,
        score: indicator.score,
        status: indicator.status,
        rationale: indicator.rationale,
        evidence: indicator.evidence,
        observedAt: indicator.observed_at,
        accountId: indicator.account_id ?? undefined,
        opportunityId: indicator.opportunity_id ?? undefined,
      }));
    return {
      report,
      indicators: aggregateRevenueExecutionSources({
        organizationId: identity.organization.id,
        membershipId: report.membership_id,
        sources,
      }),
    };
  });
  const teamSellingScores = await getTeamSellingScores(
    identity.organization.id,
    brief.reports.map((report) => report.membership_id),
  );
  return (
    <main className="rsm-today">
      <header className="rsm-hero">
        <div>
          <span className="eyebrow">AI-PREPARED MANAGER BRIEFING</span>
          <h1>Good morning, {identity.viewUser.firstName}</h1>
          <p>
            <strong>
              {brief.interventions.length} thing
              {brief.interventions.length === 1 ? "" : "s"}
            </strong>{" "}
            need your intervention today · {money(exposure)} exposure
          </p>
        </div>
        <span className="rsm-principle">
          Exceptions, decisions, commitments
        </span>
      </header>
      <section className="rsm-section">
        <div className="section-heading">
          <div>
            <h2>Needs my attention</h2>
            <p>
              Ranked by revenue exposure, urgency, unresolved risk, and
              commitment slippage.
            </p>
          </div>
        </div>
        <div className="intervention-list">
          {brief.interventions.map((item) => (
            <Link
              className="intervention-card"
              href={`/today/rsm/interventions/${item.id}`}
              key={item.id}
            >
              <div className="intervention-score">
                <strong>{item.priority_score}</strong>
                <span>priority</span>
              </div>
              <div>
                <RiskIndicator
                  level={
                    String(item.severity).toLowerCase() === "critical"
                      ? "critical"
                      : String(item.severity).toLowerCase() === "high"
                        ? "high"
                        : "medium"
                  }
                >
                  {item.severity}
                </RiskIndicator>
                <h3>
                  {item.account_name} · {money(item.amount)}
                </h3>
                <RevenueImpactBadge value={Number(item.amount ?? 0)} />
                <p>{item.summary}</p>
                <EvidencePanel evidence={item.evidence ?? []} />
                <strong className="recommended">
                  Recommended · {item.recommended_action}
                </strong>
              </div>
              <span className="open-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="rsm-grid">
        <section className="rsm-section">
          <h2>Reps needing attention</h2>
          {brief.reports.map((rep) => (
            <article className="brief-row" key={rep.membership_id}>
              <div>
                <strong>{rep.display_name}</strong>
                <small>
                  Direct report · {rep.opportunity_count} active revenue motion
                  {rep.opportunity_count === 1 ? "" : "s"} ·{" "}
                  {rep.overdue_commitments} overdue commitment
                  {rep.overdue_commitments === 1 ? "" : "s"}
                </small>
              </div>
              <span>
                {
                  brief.interventions.filter(
                    (i) => i.seller_membership_id === rep.membership_id,
                  ).length
                }{" "}
                active intervention
              </span>
            </article>
          ))}
        </section>
        <section className="rsm-section">
          <h2>Commitments</h2>
          {brief.commitments.slice(0, 5).map((item) => (
            <article className="brief-row" key={item.id}>
              <div>
                <strong>{item.description}</strong>
                <small>
                  {item.owner_name ?? "Customer"} · {item.account_name}
                </small>
              </div>
              <span
                className={new Date(item.due_at) < new Date() ? "overdue" : ""}
              >
                {item.due_at
                  ? new Date(item.due_at).toLocaleDateString()
                  : "No date"}
              </span>
            </article>
          ))}
        </section>
      </div>
      <section className="rsm-section">
        <h2>Deals needing intervention</h2>
        {brief.interventions.slice(0, 5).map((item) => (
          <article className="brief-row" key={`deal-${item.id}`}>
            <div>
              <strong>{item.opportunity_name}</strong>
              <small>{item.rationale}</small>
            </div>
            <Link href={`/today/rsm/interventions/${item.id}`}>Review →</Link>
          </article>
        ))}
      </section>
      <section className="rsm-section">
        <h2>Approvals & decisions</h2>
        {brief.decisions.length ? (
          brief.decisions.map((item) => (
            <article className="brief-row" key={item.id}>
              <div>
                <strong>{item.recommendation}</strong>
                <small>Human approval required · no automatic execution</small>
              </div>
              <DecisionApprove id={item.id} />
            </article>
          ))
        ) : (
          <p className="empty-brief">No material approvals are waiting.</p>
        )}
      </section>
      <section className="rsm-section">
        <h2>Coaching themes</h2>
        <p className="section-note">
          Evidence-backed themes for your direct reports, not a performance
          leaderboard.
        </p>
        {brief.coachingInsights?.length ? (
          brief.coachingInsights.map((insight) => (
            <article className="brief-row" key={insight.id}>
              <div>
                <strong>
                  {insight.display_name} · {insight.title}
                </strong>
                <small>{insight.insight}</small>
              </div>
              <span>{insight.suggested_action}</span>
            </article>
          ))
        ) : (
          <p className="empty-brief">No coaching themes require attention.</p>
        )}
        {brief.reports.flatMap((report) =>
          (
            teamSellingScores[report.membership_id]?.coachingSuggestions ?? []
          ).map((suggestion) => (
            <article
              className="brief-row team-selling-coaching-row"
              key={`${report.membership_id}-${suggestion}`}
            >
              <div>
                <strong>{report.display_name} · Team Selling</strong>
                <small>
                  Team Selling coverage is below the healthy standard.
                </small>
              </div>
              <span>{suggestion}</span>
            </article>
          )),
        )}
      </section>
      <section className="rsm-section rsm-ae-health-section">
        <h2>Revenue execution health by AE</h2>
        <p className="section-note">
          Five leading indicators for each AE under your management, with the
          same evidence and action model used across the revenue operating
          experience.
        </p>
        <div className="rsm-ae-health-list">
          {executionByAe.map(({ report, indicators }) => (
            <RevenueExecutionHealthStrip
              indicators={indicators}
              title={`${report.display_name}'s revenue execution health`}
              scopeLabel="their accounts"
              instanceId={report.membership_id}
              key={report.membership_id}
            />
          ))}
        </div>
      </section>
      <section className="rsm-section rsm-team-selling-section">
        <h2>Team Selling Health by AE</h2>
        <p className="section-note">
          Cross-functional cadence and customer-signal coverage for each AE on
          your team. Open an AE for coaching actions and detailed evidence.
        </p>
        <div className="rsm-team-selling-list">
          {brief.reports.map((report) => {
            const score = teamSellingScores[report.membership_id];
            return score ? (
              <TeamSellingHealthCard
                compact
                description="SE, Partner Sales, SDR, 2x2, FCTO, Value Engineering, and customer-signal coverage."
                href={`/performance/${encodeURIComponent(report.membership_id)}`}
                key={report.membership_id}
                score={score}
                title={report.display_name}
              />
            ) : null;
          })}
        </div>
      </section>
    </main>
  );
}
