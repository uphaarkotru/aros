import type { LeadingIndicatorRecord } from "@/db/leading-indicator-repository";

export function LeadingIndicatorPanel({
  indicators,
  coachingInsights,
  timeline,
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
}) {
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
        <div className="leading-indicator-grid">
          {indicators.map((indicator) => (
            <article
              className={`leading-indicator leading-${indicator.status.toLowerCase()}`}
              key={indicator.id}
            >
              <div>
                <span>{indicator.indicator_type.replaceAll("_", " ")}</span>
                <strong>{indicator.status.replaceAll("_", " ")}</strong>
              </div>
              <p>{indicator.rationale}</p>
              <ul>
                {indicator.evidence.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <p>No leading-indicator evidence is available for this account.</p>
      )}
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
