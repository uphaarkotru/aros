import Link from "next/link";
import type { AccountDigitalTwin } from "@/domain/accounts/account-digital-twin";
import type { LeadingIndicatorRecord } from "@/db/leading-indicator-repository";
import { AccountDetail } from "./account-detail";
import { EvidenceAndConfidence } from "./evidence/evidence-and-confidence";
import { LeadingIndicatorPanel } from "./leading-indicator-panel";
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
  return (
    <>
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
      <LeadingIndicatorPanel
        indicators={leadingIndicators}
        coachingInsights={coachingInsights}
        timeline={timeline}
      />
      <AccountDetail twin={twin} />
      <div className="account-evidence-region">
        <EvidenceAndConfidence twin={twin} />
      </div>
    </>
  );
}
