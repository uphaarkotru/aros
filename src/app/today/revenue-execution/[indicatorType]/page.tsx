import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { leadingIndicatorRepository } from "@/db/leading-indicator-repository";
import { revenueRepository } from "@/db/revenue-repository";
import {
  aggregateRevenueExecutionSources,
  isRevenueExecutionIndicatorType,
  revenueExecutionIndicatorDefinition,
} from "@/revenue-execution-indicators/domain";

const words = (value: string) => value.replaceAll("_", " ");

const backHref: Record<string, string> = {
  AE: "/today/ae",
  RSM: "/today/rsm",
  VP_SALES: "/today/vp-sales",
  CRO: "/today/cro",
};

export default async function RevenueExecutionIndicatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ indicatorType: string }>;
  searchParams?: Promise<{ accountId?: string }>;
}) {
  const { indicatorType } = await params;
  const accountId = (await searchParams)?.accountId;
  if (!isRevenueExecutionIndicatorType(indicatorType)) redirect("/today");

  const identity = await requireIdentity();
  if (accountId && !identity.scope?.accountIds.includes(accountId)) {
    redirect("/access-denied");
  }
  const membership = getMembership(
    identityRepository,
    identity.viewUser.id,
    identity.organization.id,
  );
  if (!membership || !leadingIndicatorRepository) redirect("/access-denied");

  const [sources, coachingInsights, cohort, account] = await Promise.all([
    leadingIndicatorRepository.listForViewer({
      organizationId: identity.organization.id,
      membershipId: membership.id,
      accountId,
    }),
    leadingIndicatorRepository.listCoachingInsights({
      organizationId: identity.organization.id,
      membershipId: membership.id,
    }),
    leadingIndicatorRepository.getOrganizationCohortBenchmark({
      organizationId: identity.organization.id,
      indicatorType,
    }),
    accountId
      ? revenueRepository.getAccount(identity.organization.id, accountId)
      : Promise.resolve(null),
  ]);
  const definition = revenueExecutionIndicatorDefinition(indicatorType);
  const relevantSources = sources.filter((source) =>
    definition.sourceTypes.includes(source.indicator_type),
  );
  const indicator = aggregateRevenueExecutionSources({
    organizationId: identity.organization.id,
    accountId,
    membershipId: membership.id,
    sources: sources.map((source) => ({
      id: source.id,
      indicatorType: source.indicator_type,
      score: source.score,
      status: source.status,
      rationale: source.rationale,
      evidence: source.evidence,
      observedAt: source.observed_at,
      accountId: source.account_id ?? undefined,
      opportunityId: source.opportunity_id ?? undefined,
    })),
  }).find((item) => item.indicatorType === indicatorType)!;
  const relevantIds = new Set(relevantSources.map((source) => source.id));
  const focusedActions = coachingInsights
    .filter((insight) => relevantIds.has(String(insight.source_indicator_id)))
    .map((insight) => String(insight.suggested_action));
  const actions = [
    ...new Set([indicator.recommendedNextAction, ...focusedActions]),
  ];
  const delta =
    indicator.score !== null && cohort.score !== null
      ? indicator.score - cohort.score
      : null;

  return (
    <main className="execution-detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href={backHref[identity.effectiveRole ?? ""] ?? "/today"}>
          Today
        </Link>
        <span>/</span>
        <span>Revenue execution health</span>
      </nav>

      <header className="execution-detail-hero">
        <div>
          <span className="eyebrow">LEADING INDICATOR DETAIL</span>
          <h1>{definition.label}</h1>
          <p>
            {account?.name ? `${account.name} · ` : ""}
            {indicator.implication}
          </p>
        </div>
        <div
          className={`execution-detail-score canonical-${indicator.status.toLowerCase()}`}
        >
          <strong>{indicator.score ?? "—"}</strong>
          <span>{words(indicator.status)}</span>
          <small>{words(indicator.trend)}</small>
        </div>
      </header>

      <section
        className="execution-comparison"
        aria-label="Benchmark comparison"
      >
        <article>
          <span>Your scoped score</span>
          <strong>{indicator.score ?? "—"}</strong>
          <small>
            {indicator.confidence.toLowerCase()} evidence confidence
          </small>
        </article>
        <article>
          <span>Organization cohort</span>
          <strong>{cohort.score ?? "—"}</strong>
          <small>
            {cohort.cohortSize} revenue motion
            {cohort.cohortSize === 1 ? "" : "s"} with evidence
          </small>
        </article>
        <article
          className={delta !== null && delta < 0 ? "comparison-gap" : ""}
        >
          <span>Difference</span>
          <strong>
            {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
          </strong>
          <small>
            {delta === null
              ? "More evidence needed"
              : delta < 0
                ? "Below organization cohort"
                : "At or above organization cohort"}
          </small>
        </article>
      </section>

      <div className="execution-detail-grid">
        <section className="execution-detail-card">
          <span className="eyebrow">FOCUS ACTIONS</span>
          <h2>What to do next</h2>
          <ol>
            {actions.slice(0, 4).map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </section>
        <section className="execution-detail-card">
          <span className="eyebrow">HEALTHY STANDARD</span>
          <h2>What good looks like</h2>
          <p>{indicator.benchmark}</p>
          <small>
            Use the cohort for context and the healthy standard as the target.
          </small>
        </section>
      </div>

      <section className="execution-detail-card execution-evidence">
        <span className="eyebrow">EXPLAINABLE EVIDENCE</span>
        <h2>What is driving this score</h2>
        {relevantSources.length ? (
          <div className="execution-evidence-list">
            {relevantSources.map((source) => (
              <article key={source.id}>
                <div>
                  <strong>{words(source.indicator_type)}</strong>
                  <span>
                    {source.score ?? "—"} · {words(source.status)}
                  </span>
                </div>
                <p>{source.rationale}</p>
                {source.evidence[0] ? (
                  <small>{source.evidence[0]}</small>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p>
            No evidence is available yet. Add a current customer-confirmed
            signal to establish the baseline.
          </p>
        )}
      </section>
    </main>
  );
}
