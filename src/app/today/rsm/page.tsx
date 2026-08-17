import "./rsm.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { DecisionApprove } from "./decision-approve";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
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
                <span
                  className={`severity severity-${String(item.severity).toLowerCase()}`}
                >
                  {item.severity}
                </span>
                <h3>
                  {item.account_name} · {money(item.amount)}
                </h3>
                <p>{item.summary}</p>
                <ul>
                  {(item.evidence ?? []).slice(0, 4).map((e: string) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
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
      </section>
    </main>
  );
}
