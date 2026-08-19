import Link from "next/link";
import { buildAccountSummary } from "@/account-digital-twin";
import type {
  AccountDigitalTwin,
  MEDDPICCField,
} from "@/domain/accounts/account-digital-twin";
import type { LeadingIndicatorRecord } from "@/db/leading-indicator-repository";
import { AccountTimeline } from "./account-timeline";
import { LeadingIndicatorPanel } from "./leading-indicator-panel";
import { currentDemoAsOfLabel } from "@/lib/demo-clock";
const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
const pretty = (v: string) => v.replaceAll("-", " ");
function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="health-score-row">
      <span>{label}</span>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}
function Meddpicc({ field }: { field: MEDDPICCField }) {
  return (
    <article className="meddpicc-field">
      <div>
        <h3>{pretty(field.key)}</h3>
        <span>
          {field.status} · {Math.round(field.confidence * 100)}%
        </span>
      </div>
      <p>{field.value || field.gaps[0]}</p>
      <small>{field.recommendedNextStep}</small>
    </article>
  );
}
export function AccountDetail({
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
    <article>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/accounts">Accounts</Link>
        <span>/</span>
        <span>{twin.identity.name}</span>
      </nav>
      <header className="account-detail-header">
        <div>
          <span className="eyebrow">
            ACCOUNT DIGITAL TWIN · AS OF {currentDemoAsOfLabel()}
          </span>
          <h1>{twin.identity.name}</h1>
          <p>
            {twin.identity.segment} · Tier {twin.identity.strategicTier} · Owner{" "}
            {twin.identity.ownerName}
          </p>
        </div>
        <span className={`health-hero health-${twin.health.overallStatus}`}>
          <strong>{twin.health.overallScore}</strong>
          <small>{twin.health.overallStatus} · leading indicators</small>
        </span>
        <dl>
          <div>
            <dt>Annual contract</dt>
            <dd>{money(twin.commercialProfile.annualContractValue)}</dd>
          </div>
          <div>
            <dt>Renewal</dt>
            <dd>
              {new Date(
                twin.commercialProfile.renewalDate,
              ).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt>Open pipeline</dt>
            <dd>{money(twin.commercialProfile.openPipelineValue)}</dd>
          </div>
        </dl>
      </header>
      <section className="ai-summary">
        <span>✦</span>
        <div>
          <h2>AI account summary</h2>
          <p>{buildAccountSummary(twin)}</p>
        </div>
      </section>
      <div className="twin-grid">
        <LeadingIndicatorPanel
          indicators={leadingIndicators}
          coachingInsights={coachingInsights}
          timeline={timeline}
        />
        <section className="twin-card">
          <h2>Active decisions</h2>
          {twin.activeDecisions.map((d) => (
            <article className="twin-decision" key={d.id}>
              <span>{d.priority}</span>
              <h3>{d.title}</h3>
              <p>{d.recommendedAction}</p>
            </article>
          ))}
          {!twin.activeDecisions.length && <p>No active decisions.</p>}
        </section>
        <section className="twin-card twin-wide">
          <h2>Stakeholder map</h2>
          <div className="stakeholder-grid">
            {twin.stakeholders.map((s) => (
              <article key={s.id}>
                <span>{pretty(s.roleInBuyingProcess)}</span>
                <h3>{s.name}</h3>
                <p>{s.title}</p>
                <small>
                  {s.relationshipStrength} · {s.engagementTrend} · last
                  interaction{" "}
                  {new Date(s.lastInteractionAt).toLocaleDateString()}
                </small>
              </article>
            ))}
          </div>
        </section>
        <section className="twin-card">
          <h2>Opportunities & renewal</h2>
          {twin.opportunities.map((o) => (
            <article className="commercial-item" key={o.id}>
              <h3>{o.name}</h3>
              <strong>{money(o.amount)}</strong>
              <p>
                {o.stage} · {o.daysInStage} days in stage
              </p>
              <small>Next: {o.nextStep}</small>
            </article>
          ))}
          <p>
            Renewal likelihood:{" "}
            {Math.round((twin.renewalProfile?.renewalLikelihood ?? 0) * 100)}%
          </p>
        </section>
        <section className="twin-card">
          <h2>Product usage</h2>
          {twin.productUsage.map((u) => (
            <article className="commercial-item" key={u.productId}>
              <h3>{u.productName}</h3>
              <strong>{Math.round(u.adoptionRate * 100)}% adoption</strong>
              <p>
                {u.usageTrend} · {u.activeUsers}/{u.licensedUsers} active
              </p>
              <small>Unused: {u.unusedCapabilities.join(", ")}</small>
            </article>
          ))}
        </section>
        <section className="twin-card twin-wide">
          <h2>MEDDPICC · {twin.meddpicc.completenessScore}% complete</h2>
          <div className="meddpicc-grid">
            {twin.meddpicc.fields.map((f) => (
              <Meddpicc key={f.key} field={f} />
            ))}
          </div>
        </section>
        <AccountTimeline events={twin.fullTimeline} />
        <section className="twin-card">
          <h2>Risks & opportunities</h2>
          <h3>Known risks</h3>
          <ul>
            {twin.knownRisks.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h3>Expansion signals</h3>
          <ul>
            {twin.expansionSignals.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <h3>Unresolved questions</h3>
          <ul>
            {twin.unresolvedQuestions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="twin-card">
          <h2>Data confidence</h2>
          <Score label="Overall" value={twin.dataQuality.overallScore} />
          <Score
            label="Completeness"
            value={twin.dataQuality.completenessScore}
          />
          <Score label="Freshness" value={twin.dataQuality.freshnessScore} />
          <h3>Source coverage</h3>
          {twin.sourceCoverage.map((s) => (
            <p key={s.source}>
              {s.source}: simulated · {s.recordCount} records ·{" "}
              {s.freshnessStatus}
            </p>
          ))}
        </section>
      </div>
    </article>
  );
}
