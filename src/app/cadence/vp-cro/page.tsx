import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { query } from "@/db/client";
import { CadenceAgenda, PriorityCard } from "@/components/revenue-operating";

export default async function VpCroCadencePage() {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "VP_SALES" && identity.effectiveRole !== "CRO") redirect("/access-denied");
  const [health, strategicRisks, decisions] = await Promise.all([
    query(`SELECT count(DISTINCT o.id)::int AS opportunities,COALESCE(sum(o.amount),0)::float8 AS pipeline,COALESCE(avg(f.probability),0)::float8 AS confidence FROM opportunities o LEFT JOIN forecast_assessments f ON(f.organization_id=o.organization_id AND f.opportunity_id=o.id) WHERE o.organization_id=$1`, [identity.organization.id]),
    query(`SELECT li.id,li.summary,li.rationale,li.priority_score,li.level,o.name AS opportunity_name,a.name AS account_name,o.amount::float8 AS amount FROM leadership_interventions li JOIN opportunities o ON(o.organization_id=li.organization_id AND o.id=li.opportunity_id) JOIN accounts a ON(a.organization_id=o.organization_id AND a.id=o.account_id) WHERE li.organization_id=$1 AND li.status IN('ELIGIBLE','PENDING') ORDER BY li.priority_score DESC LIMIT 8`, [identity.organization.id]),
    query(`SELECT id,recommendation,status,metadata FROM action_decisions WHERE organization_id=$1 AND status='PENDING' ORDER BY updated_at DESC LIMIT 8`, [identity.organization.id]),
  ]);
  return <main className="rsm-today"><header className="rsm-hero"><div><span className="eyebrow">EXECUTIVE OPERATING CADENCE</span><h1>VP–CRO Executive Review</h1><p>Company revenue health, forecast confidence, strategic risks, and leadership decisions.</p></div><Link className="secondary-button" href="/today">Open executive briefing →</Link></header><CadenceAgenda title="Company revenue health" purpose="Make company-level decisions and record the expected outcome." sections={[{heading:"Company revenue health",children:<div className="operating-list"><span><strong>{health.rows[0]?.opportunities ?? 0}</strong> opportunities in scope</span><span><strong>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact"}).format(Number(health.rows[0]?.pipeline ?? 0))}</strong> pipeline</span><span><strong>{Math.round(Number(health.rows[0]?.confidence ?? 0))}%</strong> forecast confidence</span></div>},{heading:"Strategic risks",children:<div className="pattern-list">{strategicRisks.rows.map((item) => <PriorityCard key={item.id} item={{id:item.id,stage:"DECISION",title:item.opportunity_name,summary:item.rationale,accountName:item.account_name,revenueImpact:Number(item.amount ?? 0),status:item.level}} />)}</div>},{heading:"Leadership decisions",children:<ul className="operating-list">{decisions.rows.map((item) => <li key={item.id}><strong>{item.status}</strong> · {item.recommendation}</li>)}</ul>},{heading:"Outcome",children:<p>Approve, reject, assign an executive sponsor, or create an executive action. The resulting outcome is persisted to the Digital Twin timeline.</p>}]}/></main>;
}
