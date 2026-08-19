import Link from "next/link";
import { requireIdentity } from "@/auth/guards.server";
import { query } from "@/db/client";
import { OperatingPage } from "@/components/operating-page";

export default async function OpportunitiesPage() {
  const identity = await requireIdentity();
  const opportunityIds = identity.scope?.opportunityIds ?? [];
  const accountIds = identity.scope?.accountIds ?? [];
  const scopePredicate =
    "(o.id=ANY($2::text[]) OR o.account_id=ANY($2::text[]))";
  const scopedIds = [...new Set([...opportunityIds, ...accountIds])];
  const result = await query(
    `SELECT o.id,o.account_id,o.name,o.amount::float8 AS amount,o.stage,o.seller_forecast_category,o.manager_forecast_category,f.aros_category,f.probability,a.name AS account_name FROM opportunities o JOIN accounts a ON(a.organization_id=o.organization_id AND a.id=o.account_id) LEFT JOIN LATERAL(SELECT * FROM forecast_assessments f0 WHERE f0.organization_id=o.organization_id AND f0.opportunity_id=o.id ORDER BY f0.updated_at DESC LIMIT 1) f ON true WHERE o.organization_id=$1 AND ${scopePredicate} ORDER BY o.amount DESC`,
    [identity.organization.id, scopedIds],
  );
  return (
    <OperatingPage activeSection="opportunities">
      <main className="rsm-today operating-light">
        <header className="rsm-hero">
          <div>
            <span className="eyebrow">REVENUE MOTIONS</span>
            <h1>Opportunities</h1>
            <p>
              Pipeline motions with risk, forecast confidence, and next
              operating action.
            </p>
          </div>
        </header>
        <section className="rsm-section">
          <div className="cadence-meeting-list">
            {result.rows.map((item) => (
              <Link
                className="cadence-meeting-card"
                href={`/accounts/${item.account_id ?? "acct-coinbase"}/timeline`}
                key={item.id}
              >
                <div className="cadence-meeting-body">
                  <span className="eyebrow">{item.account_name}</span>
                  <h3>{item.name}</h3>
                  <p>
                    {item.stage ?? "Stage not set"} ·{" "}
                    {item.aros_category ?? "No AROS assessment"}
                  </p>
                  <small>
                    Forecast confidence {item.probability ?? "—"}% · Next action
                    follows evidence
                  </small>
                </div>
                <strong>
                  {item.amount
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        notation: "compact",
                      }).format(Number(item.amount))
                    : "Revenue not set"}
                </strong>
              </Link>
            ))}
          </div>
          {!result.rows.length && (
            <p className="empty-brief">
              No opportunities are currently in your authorized scope.
            </p>
          )}
        </section>
      </main>
    </OperatingPage>
  );
}
