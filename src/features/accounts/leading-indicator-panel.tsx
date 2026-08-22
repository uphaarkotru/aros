import Link from "next/link";
import type { LeadingIndicatorRecord } from "@/db/leading-indicator-repository";
import {
  aggregateRevenueExecutionSources,
  revenueExecutionIndicatorDefinition,
} from "@/revenue-execution-indicators/domain";

export function LeadingIndicatorPanel({
  indicators,
  coachingInsights,
  timeline,
  accountId,
}: {
  indicators: LeadingIndicatorRecord[];
  coachingInsights: Array<{
    id: string;
    title: string;
    insight: string;
    suggested_action: string;
  }>;
  timeline: Array<{
    event_type: string;
    payload: { summary?: string };
    occurred_at: string;
  }>;
  accountId?: string;
}) {
  const scopedAccountId =
    accountId ??
    indicators.find((indicator) => indicator.account_id)?.account_id ??
    undefined;
  const canonical = indicators.length
    ? aggregateRevenueExecutionSources({
        organizationId: indicators[0].organization_id,
        accountId: scopedAccountId,
        sources: indicators.map((indicator) => ({
          id: indicator.id,
          indicatorType: indicator.indicator_type,
          score: indicator.score,
          status: indicator.status,
          rationale: indicator.rationale,
          evidence: indicator.evidence,
          observedAt: indicator.observed_at,
          accountId: indicator.account_id ?? scopedAccountId,
          opportunityId: indicator.opportunity_id ?? undefined,
        })),
      })
    : [];
  return (
    <section className="twin-card twin-wide leading-indicator-panel">
      <div className="twin-section-head">
        <div>
          <span className="eyebrow">
            EVIDENCE LAYER · REVENUE EXECUTION HEALTH
          </span>
          <h2>Leading indicators</h2>
          <p>
            AROS explains the operating evidence behind account health; missing
            evidence remains unknown.
          </p>
        </div>
      </div>
      {indicators.length ? (
        <>
          <div className="canonical-indicator-grid">
            {canonical.map((indicator) => (
              <Link
                className={`canonical-indicator canonical-${indicator.status.toLowerCase()}`}
                href={`/today/revenue-execution/${indicator.indicatorType}${scopedAccountId ? `?accountId=${encodeURIComponent(scopedAccountId)}` : ""}`}
                key={indicator.indicatorType}
                title="Open indicator details"
              >
                <div>
                  <span>
                    {
                      revenueExecutionIndicatorDefinition(
                        indicator.indicatorType,
                      ).label
                    }
                  </span>
                  <strong>{indicator.score ?? "—"}</strong>
                </div>
                <small>
                  {indicator.status.replaceAll("_", " ")} · {indicator.trend}
                </small>
                <p>{indicator.rationale}</p>
                {indicator.evidence.length ? (
                  <ul className="canonical-evidence">
                    {indicator.evidence.slice(0, 3).map((item) => (
                      <li key={`${item.sourceId ?? "evidence"}-${item.text}`}>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <small>
                  <strong>Benchmark:</strong> {indicator.benchmark}
                </small>
                <small>
                  <strong>Next:</strong> {indicator.recommendedNextAction}
                </small>
              </Link>
            ))}
          </div>
        </>
      ) : null}
      {!indicators.length ? (
        <p>No leading-indicator evidence is available for this account.</p>
      ) : null}
      {coachingInsights.length ? (
        <div className="coaching-insights">
          <h3>Suggested coaching</h3>
          {coachingInsights.map((insight) => (
            <article key={insight.id}>
              <strong>{insight.title}</strong>
              <p>{insight.insight}</p>
              <small>Suggested action · {insight.suggested_action}</small>
            </article>
          ))}
        </div>
      ) : null}
      {timeline.length ? (
        <div className="indicator-timeline">
          <h3>Leading-indicator history</h3>
          <ol>
            {timeline.map((event, index) => (
              <li key={`${event.event_type}-${event.occurred_at}-${index}`}>
                <time>{new Date(event.occurred_at).toLocaleDateString()}</time>
                <span>
                  {event.event_type
                    .replaceAll("LEADING_INDICATOR_", "")
                    .replaceAll("_", " ")}
                </span>
                <p>{event.payload?.summary ?? "Indicator evidence changed."}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
