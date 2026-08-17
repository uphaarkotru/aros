import "../../rsm.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { getRevenueTeamCoverage } from "@/auth/revenue-team-coverage";
import { identityRepository } from "@/auth/repository.server";
import { InterventionActions } from "./intervention-actions";
import { getMembership } from "@/auth/tenant-model";
export default async function Page(props: {
  params: Promise<{ interventionId: string }>;
}) {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "RSM") redirect("/access-denied");
  const effectiveMembership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    { interventionId } = await props.params,
    data = cadenceRepository
      ? await cadenceRepository.getIntervention(
          identity.organization.id,
          effectiveMembership?.id ?? identity.membership.id,
          interventionId,
        )
      : null;
  if (!data) notFound();
  const coverage = getRevenueTeamCoverage(identityRepository, {
    organizationId: identity.organization.id,
    opportunityId: data.intervention.opportunity_id,
  });
  return (
    <main className="rsm-today intervention-detail">
      <Link className="back-link" href="/today/rsm">
        ← RSM Today
      </Link>
      <header className="rsm-hero">
        <div>
          <span className="eyebrow">
            MANAGER INTERVENTION · {data.intervention.severity}
          </span>
          <h1>{data.intervention.summary}</h1>
          <p>{data.intervention.rationale}</p>
        </div>
        <div className="intervention-score large">
          <strong>{data.intervention.priority_score}</strong>
          <span>priority</span>
        </div>
      </header>
      <InterventionActions
        id={data.intervention.id}
        status={data.intervention.status}
        version={data.intervention.version}
      />
      <div className="rsm-grid">
        <section className="rsm-section">
          <h2>Why this is surfaced</h2>
          <ul className="evidence-list">
            {data.intervention.evidence.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>Recommended intervention</h3>
          <p className="recommendation-panel">
            {data.intervention.recommended_action}
            <small>
              Human approval is required before team or cadence changes.
            </small>
          </p>
        </section>
        <section className="rsm-section">
          <h2>Revenue Team</h2>
          {data.team.map((item, index) => (
            <article
              className="brief-row"
              key={`${item.display_name}-${item.participation_type}-${index}`}
            >
              <div>
                <strong>{item.display_name}</strong>
                <small>{item.organization_role ?? "Custom role"}</small>
              </div>
              <span>{item.participation_type}</span>
            </article>
          ))}
          <p className="scope-note">
            Revenue participation provides relevant deal context. It does not
            grant you performance-management authority over cross-functional
            participants.
          </p>
        </section>
      </div>
      <section className="rsm-section">
        <h2>Coverage</h2>
        <div className="coverage-grid">
          {Object.entries(coverage)
            .filter(([key]) => !["OWNER", "SDR_SUPPORT"].includes(key))
            .map(([key, value]) => (
              <span className={value ? "covered" : "gap"} key={key}>
                {value ? "✓" : "○"} {key.replaceAll("_", " ")}
              </span>
            ))}
        </div>
      </section>
      <div className="rsm-grid">
        <section className="rsm-section">
          <h2>Commitments</h2>
          {data.commitments.map((item) => (
            <article className="brief-row" key={item.id}>
              <div>
                <strong>{item.description}</strong>
                <small>{item.expected_outcome}</small>
              </div>
              <span>{item.status}</span>
            </article>
          ))}
        </section>
        <section className="rsm-section">
          <h2>Cadence memory</h2>
          {data.cadences.map((item) => (
            <article className="brief-row" key={item.id}>
              <div>
                <strong>
                  <Link href={`/cadences/${item.id}`}>
                    {item.template_name}
                  </Link>
                </strong>
                <small>{item.preparation_summary}</small>
              </div>
              <span>{item.status}</span>
            </article>
          ))}
        </section>
      </div>
      <section className="rsm-section">
        <h2>Blockers & escalation</h2>
        {data.blockers.map((item) => (
          <article className="brief-row" key={item.id}>
            <div>
              <strong>{item.description}</strong>
              <small>
                Open since{" "}
                {new Date(item.first_observed_at).toLocaleDateString()}
              </small>
            </div>
            <span>{item.severity}</span>
          </article>
        ))}
        {data.escalations.map((item) => (
          <article className="brief-row" key={item.id}>
            <div>
              <strong>{item.reason}</strong>
              <small>
                {item.from_level} → {item.to_level}
              </small>
            </div>
            <span>{item.status}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
