import Link from "next/link";
import type { AccountDigitalTwin } from "@/domain/accounts/account-digital-twin";
import type { LeadingIndicatorRecord } from "@/db/leading-indicator-repository";
import {
  aggregateRevenueExecutionSources,
  summarizeRevenueExecutionHealth,
} from "@/revenue-execution-indicators/domain";
import { AccountDetail } from "./account-detail";
import { EvidenceAndConfidence } from "./evidence/evidence-and-confidence";
export function ReconciledAccountDetail({
  twin,
  leadingIndicators = [],
  coachingInsights = [],
  timeline = [],
}: {
  twin: AccountDigitalTwin;
  leadingIndicators?: LeadingIndicatorRecord[];
  coachingInsights?: Array<{
    id: string;
    title: string;
    insight: string;
    suggested_action: string;
  }>;
  timeline?: Array<{
    event_type: string;
    payload: { summary?: string };
    occurred_at: string;
  }>;
}) {
  const accountIndicators = leadingIndicators.length
    ? aggregateRevenueExecutionSources({
        organizationId: leadingIndicators[0].organization_id,
        accountId: twin.accountId,
        sources: leadingIndicators.map((indicator) => ({
          id: indicator.id,
          indicatorType: indicator.indicator_type,
          score: indicator.score,
          status: indicator.status,
          rationale: indicator.rationale,
          evidence: indicator.evidence,
          observedAt: indicator.observed_at,
          accountId: indicator.account_id ?? twin.accountId,
          opportunityId: indicator.opportunity_id ?? undefined,
        })),
      })
    : [];
  const derivedHealth = summarizeRevenueExecutionHealth(accountIndicators);
  const derivedTwin = accountIndicators.some(
    (indicator) => indicator.score !== null,
  )
    ? {
        ...twin,
        health: {
          ...twin.health,
          overallScore: derivedHealth.score ?? twin.health.overallScore,
          overallStatus:
            derivedHealth.status === "UNKNOWN"
              ? twin.health.overallStatus
              : (derivedHealth.status
                  .toLowerCase()
                  .replaceAll("_", "-") as typeof twin.health.overallStatus),
        },
      }
    : twin;
  return (
    <>
      <AccountDetail
        twin={derivedTwin}
        leadingIndicators={leadingIndicators}
        coachingInsights={coachingInsights}
        timeline={timeline}
      />
      {twin.accountId === "acct-coinbase" && (
        <section className="renewal-entry">
          <div>
            <span className="eyebrow">
              RENEWAL INTELLIGENCE · DESIGN PARTNER WORKSPACE
            </span>
            <h2>AROS has prioritized the Coinbase renewal</h2>
            <p>
              Review health changes, MEDDPICC gaps, leading indicators,
              evidence, and governed plays.
            </p>
          </div>
          <Link
            className="primary-button"
            href={`/accounts/${twin.accountId}/renewal`}
          >
            Open Renewal Intelligence →
          </Link>
        </section>
      )}
      <div className="account-evidence-region">
        <EvidenceAndConfidence twin={derivedTwin} />
      </div>
    </>
  );
}
