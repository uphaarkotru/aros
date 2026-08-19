import Link from "next/link";
import type { RevenueExecutionIndicator } from "@/revenue-execution-indicators/domain";
import { RevenueExecutionHealthStrip } from "@/features/morning-briefing/morning-briefing-dashboard";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const words = (value: string) => value.replaceAll("_", " ");

export interface LeadershipBrief {
  level: "VP" | "CRO";
  rollup: {
    opportunityCount: number;
    sellerCommit: number;
    managerCommit: number;
    evidenceWeighted: number;
    variance: number;
    atRisk: number;
    upside: number;
  };
  assessments: Array<{
    id: string;
    account_name: string;
    opportunity_name: string;
    amount: number;
    seller_category: string | null;
    manager_category: string | null;
    aros_category: string;
    probability: number;
    previous_probability: number | null;
    rationale: string;
    change_drivers: string[];
  }>;
  interventions: Array<{
    id: string;
    level: string;
    type: string;
    priority_score: number;
    account_name: string;
    amount: number;
    rationale: string;
    recommended_action: string;
  }>;
  patterns: Array<{
    type: string;
    opportunity_count: number;
    affected_revenue: number;
  }>;
  operating: Record<string, number>;
  managerHealth: Array<{
    membership_id: string;
    display_name: string;
    interventions: number;
    progressed: number;
    overdue_commitments: number;
  }>;
  coachingThemes?: Array<{
    indicator_type: string;
    seller_count: number;
    insight_count: number;
  }>;
  executionIndicators?: RevenueExecutionIndicator[];
}

export function LeadershipBriefing({
  name,
  brief,
}: {
  name: string;
  brief: LeadershipBrief;
}) {
  const isCro = brief.level === "CRO",
    attention = brief.assessments.filter(
      (item) => item.aros_category === "HIGH_RISK",
    );
  return (
    <main className="leadership-today">
      <header className="leadership-hero">
        <div>
          <span className="eyebrow">
            {isCro
              ? "REVENUE ORGANIZATION INTELLIGENCE"
              : "VP REVENUE OPERATING INTELLIGENCE"}
          </span>
          <h1>Good morning, {name}</h1>
          <p>
            <strong>{money(brief.rollup.atRisk)}</strong> requires leadership
            attention across {attention.length} evidence-backed exception
            {attention.length === 1 ? "" : "s"}.
          </p>
        </div>
        <blockquote>
          Information rolls upward. Only material decisions do.
        </blockquote>
      </header>

      <section className="leadership-metrics" aria-label="Revenue outlook">
        <article>
          <span>Seller commit</span>
          <strong>{money(brief.rollup.sellerCommit)}</strong>
        </article>
        <article>
          <span>Manager commit</span>
          <strong>{money(brief.rollup.managerCommit)}</strong>
        </article>
        <article className={brief.rollup.variance < 0 ? "metric-risk" : ""}>
          <span>AROS evidence-weighted</span>
          <strong>{money(brief.rollup.evidenceWeighted)}</strong>
          <small>{money(brief.rollup.variance)} vs manager</small>
        </article>
        <article>
          <span>Assessment scope</span>
          <strong>{brief.rollup.opportunityCount}</strong>
          <small>unique opportunities</small>
        </article>
      </section>

      <RevenueExecutionHealthStrip
        indicators={brief.executionIndicators ?? []}
        title={
          isCro
            ? "My organizational revenue execution health"
            : "My regional revenue execution health"
        }
        scopeLabel={isCro ? "the organization" : "your region"}
      />
      <section className="leadership-section">
        <header>
          <div>
            <h2>Executive attention required</h2>
            <p>
              Exceptions where prior frontline and manager action has not yet
              resolved the revenue risk.
            </p>
          </div>
        </header>
        <div className="leadership-attention-list">
          {brief.interventions.length ? (
            brief.interventions.map((item) => (
              <Link
                href={`/today/leadership/interventions/${item.id}`}
                key={item.id}
              >
                <div className="leadership-priority">
                  <strong>{item.priority_score}</strong>
                  <span>priority</span>
                </div>
                <div>
                  <span className="eyebrow">
                    {item.level} · {words(item.type)}
                  </span>
                  <h3>
                    {item.account_name} · {money(Number(item.amount))}
                  </h3>
                  <p>{item.rationale}</p>
                  <strong>Recommended · {item.recommended_action}</strong>
                </div>
                <b>→</b>
              </Link>
            ))
          ) : (
            <p className="leadership-empty">
              No {brief.level} interventions are currently eligible.
            </p>
          )}
        </div>
      </section>
      <section className="leadership-section">
        <h2>Coaching themes across scope</h2>
        <p className="section-note">
          Execution patterns for coaching and operating improvement, not
          individual ranking.
        </p>
        <div className="pattern-list">
          {(brief.coachingThemes ?? []).map((theme) => (
            <article key={theme.indicator_type}>
              <span>{words(theme.indicator_type)}</span>
              <strong>{theme.seller_count} sellers</strong>
              <small>
                {theme.insight_count} evidence-backed insight
                {theme.insight_count === 1 ? "" : "s"}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="leadership-section">
        <header>
          <div>
            <h2>Forecast movement & discrepancies</h2>
            <p>
              Seller and manager judgment remain distinct from AROS evidence.
            </p>
          </div>
        </header>
        <div className="forecast-list">
          {brief.assessments.slice(0, 8).map((item) => {
            const movement =
              item.previous_probability == null
                ? null
                : item.probability - item.previous_probability;
            return (
              <article key={item.id}>
                <div>
                  <span className="eyebrow">{item.account_name}</span>
                  <h3>{item.opportunity_name}</h3>
                  <p>{item.rationale}</p>
                </div>
                <dl>
                  <div>
                    <dt>Seller</dt>
                    <dd>{item.seller_category ?? "UNSET"}</dd>
                  </div>
                  <div>
                    <dt>Manager</dt>
                    <dd>{item.manager_category ?? "UNSET"}</dd>
                  </div>
                  <div
                    className={`forecast-${item.aros_category.toLowerCase()}`}
                  >
                    <dt>AROS evidence</dt>
                    <dd>{words(item.aros_category)}</dd>
                  </div>
                  <div>
                    <dt>Probability</dt>
                    <dd>
                      {item.probability}%
                      {movement !== null && (
                        <small className={movement < 0 ? "down" : "up"}>
                          {movement > 0 ? "+" : ""}
                          {movement} pts
                        </small>
                      )}
                    </dd>
                  </div>
                </dl>
                <ul>
                  {(item.change_drivers ?? [])
                    .slice(0, 3)
                    .map((driver: string) => (
                      <li key={driver}>{driver}</li>
                    ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <div className="leadership-grid">
        <section className="leadership-section">
          <h2>Manager & team operating health</h2>
          <p className="section-note">
            Context for coaching—not a public activity leaderboard.
          </p>
          {brief.managerHealth.map((manager) => (
            <article className="leadership-row" key={manager.membership_id}>
              <div>
                <strong>{manager.display_name}</strong>
                <small>
                  {manager.interventions} interventions · {manager.progressed}{" "}
                  progressed
                </small>
              </div>
              <span>{manager.overdue_commitments} overdue commitments</span>
            </article>
          ))}
        </section>
        <section className="leadership-section">
          <h2>Operating rhythm exceptions</h2>
          <div className="operating-list">
            <span>
              <strong>{brief.operating.overdue_commitments ?? 0}</strong>
              overdue strategic commitments
            </span>
            <span>
              <strong>{brief.operating.unresolved_blockers ?? 0}</strong>
              unresolved cross-functional blockers
            </span>
            <span>
              <strong>
                {brief.operating.active_manager_interventions ?? 0}
              </strong>
              active manager interventions
            </span>
            <span>
              <strong>{brief.operating.escalation_backlog ?? 0}</strong>
              {brief.level} escalations awaiting action
            </span>
            <span>
              <strong>{brief.operating.completed_cadences ?? 0}</strong>
              substantive cadences completed in 30 days
            </span>
          </div>
        </section>
      </div>

      <section className="leadership-section">
        <header>
          <div>
            <h2>Cross-functional friction</h2>
            <p>
              Deterministic grouping of unresolved blockers; patterns are
              observed alongside forecast risk, not asserted as causality.
            </p>
          </div>
        </header>
        <div className="pattern-list">
          {brief.patterns.map((pattern) => (
            <article key={pattern.type}>
              <span>{words(pattern.type)}</span>
              <strong>{pattern.opportunity_count} revenue motions</strong>
              <small>{money(Number(pattern.affected_revenue))} affected</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
