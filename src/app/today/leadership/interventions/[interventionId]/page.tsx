import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { leadershipRepository } from "@/db/leadership-repository";
import { LeadershipActions } from "@/features/leadership/leadership-actions";
import "../../../leadership.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export default async function Page({
  params,
}: {
  params: Promise<{ interventionId: string }>;
}) {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "VP_SALES" && identity.effectiveRole !== "CRO")
    redirect("/access-denied");
  const membership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    { interventionId } = await params;
  if (!membership || !leadershipRepository) redirect("/access-denied");
  const data = await leadershipRepository.getIntervention(
    identity.organization.id,
    interventionId,
    membership.id,
  );
  if (!data) redirect("/access-denied");
  const item = data.intervention;
  return (
    <main className="leadership-today leadership-detail">
      <header className="leadership-hero">
        <div>
          <span className="eyebrow">{item.level} LEADERSHIP INTERVENTION</span>
          <h1>{item.account_name}</h1>
          <p>
            {item.opportunity_name} · {money(Number(item.amount))} exposure
          </p>
        </div>
        <strong className="detail-status">{item.status}</strong>
      </header>
      <section className="leadership-section detail-forecast">
        <h2>Forecast triangle</h2>
        <dl>
          <div>
            <dt>Seller</dt>
            <dd>{item.seller_category}</dd>
          </div>
          <div>
            <dt>Manager</dt>
            <dd>{item.manager_category}</dd>
          </div>
          <div>
            <dt>AROS evidence</dt>
            <dd>{item.aros_category.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Probability</dt>
            <dd>{item.probability}%</dd>
          </div>
          <div>
            <dt>Assessment confidence</dt>
            <dd>{item.confidence}</dd>
          </div>
        </dl>
        <p>{item.forecast_rationale}</p>
      </section>
      <div className="leadership-grid">
        <section className="leadership-section">
          <h2>What changed and why it matters</h2>
          <ul>
            {(item.change_drivers ?? []).map((entry: string) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          <h3>Positive evidence</h3>
          <ul>
            {(item.positive_evidence ?? []).map((entry: string) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          <h3>Missing evidence</h3>
          <ul>
            {(item.missing_evidence ?? []).map((entry: string) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </section>
        <section className="leadership-section">
          <h2>Recommended executive action</h2>
          <p>{item.rationale}</p>
          <strong>{item.recommended_action}</strong>
          <p>Expected outcome · {item.expected_outcome}</p>
          <LeadershipActions
            interventionId={item.id}
            assessmentId={item.assessment_id}
            canApprove={item.status === "ELIGIBLE" || item.status === "PENDING"}
          />
        </section>
      </div>
      <section className="leadership-section">
        <h2>Lower-level interventions already attempted</h2>
        {data.cadences.map((cadence) => (
          <article className="leadership-row" key={cadence.id}>
            <div>
              <strong>{cadence.name}</strong>
              <small>{cadence.preparation_summary}</small>
            </div>
            <span>{cadence.status}</span>
          </article>
        ))}
      </section>
      <div className="leadership-grid">
        <section className="leadership-section">
          <h2>Commitments & blockers</h2>
          {data.commitments.map((commitment) => (
            <article className="leadership-row" key={commitment.id}>
              <div>
                <strong>{commitment.description}</strong>
                <small>{commitment.owner_name ?? "Customer"}</small>
              </div>
              <span>{commitment.status}</span>
            </article>
          ))}
          {data.blockers.map((blocker) => (
            <article className="leadership-row" key={blocker.id}>
              <div>
                <strong>{blocker.description}</strong>
                <small>{blocker.type}</small>
              </div>
              <span>{blocker.status}</span>
            </article>
          ))}
        </section>
        <section className="leadership-section">
          <h2>Revenue team</h2>
          {data.team.map((member) => (
            <article
              className="leadership-row"
              key={`${member.display_name}-${member.participation_type}`}
            >
              <strong>{member.display_name}</strong>
              <span>{member.participation_type.replaceAll("_", " ")}</span>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
