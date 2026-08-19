import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { query } from "@/db/client";
import { getAccountOperatingTimeline } from "@/db/operating-repository";
import { EvidencePanel } from "@/components/revenue-operating";
import { CreateStrategic2x2 } from "./create-2x2";

export default async function Strategic2x2Page() {
  const identity = await requireIdentity();
  if (!["AE", "RSM", "SALES_ENGINEER", "SALES_ENGINEER_MANAGER"].includes(identity.effectiveRole ?? "")) redirect("/access-denied");
  const accountId = identity.scope?.accountIds.includes("acct-coinbase") ? "acct-coinbase" : identity.scope?.accountIds[0];
  if (!accountId) return <main className="rsm-today"><h1>Strategic 2x2 unavailable</h1><p>No authorized account scope is available.</p></main>;
  const [account, opportunity, timeline, people] = await Promise.all([
    query<{ name: string }>(`SELECT name FROM accounts WHERE organization_id=$1 AND id=$2`, [identity.organization.id, accountId]),
    query<{ id: string; name: string; amount: number }>(`SELECT id,name,amount::float8 AS amount FROM opportunities WHERE organization_id=$1 AND account_id=$2 ORDER BY amount DESC LIMIT 1`, [identity.organization.id, accountId]),
    getAccountOperatingTimeline(identity.organization.id, accountId),
    query<{ membershipId: string; displayName: string }>(`SELECT m.id AS "membershipId",u.display_name AS "displayName" FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.id IN ('membership-org-cognivit-demo-user-ae-sarah','membership-org-cognivit-demo-user-se-raj','membership-org-cognivit-demo-user-se-manager-anita','membership-org-cognivit-demo-user-rsm-mark')`, [identity.organization.id]),
  ]);
  const deal = opportunity.rows[0];
  const roleByMembership = new Map([
    ["membership-org-cognivit-demo-user-ae-sarah", "AE"],
    ["membership-org-cognivit-demo-user-se-raj", "SALES_ENGINEER"],
    ["membership-org-cognivit-demo-user-se-manager-anita", "SALES_ENGINEER_MANAGER"],
    ["membership-org-cognivit-demo-user-rsm-mark", "RSM"],
  ]);
  const participantRows = people.rows.map((person) => ({ ...person, role: roleByMembership.get(person.membershipId) ?? "REVENUE_TEAM" }));
  return <main className="rsm-today"><header className="rsm-hero"><div><span className="eyebrow">STRATEGIC INTERVENTION CADENCE</span><h1>Strategic 2x2</h1><p>{account.rows[0]?.name ?? "Coinbase"} · AE + SE + SE Manager + RSM</p></div><Link className="secondary-button" href={`/accounts/${accountId}/timeline`}>Open account timeline →</Link></header><section className="rsm-section"><h2>Why this meeting exists</h2><p>Three deteriorating leading indicators require cross-functional ownership before the renewal checkpoint.</p><EvidencePanel evidence={timeline.filter((item) => ["SIGNAL", "INSIGHT"].includes(item.kind)).slice(0, 4).map((item) => item.summary)} /></section><div className="rsm-grid"><section className="rsm-section"><h2>AI-prepared agenda</h2><ol className="operating-list"><li><strong>1 · Executive sponsor</strong><span>Choose the sponsor and customer alignment message.</span></li><li><strong>2 · Recovery plan</strong><span>Assign dated owners for security and executive engagement.</span></li><li><strong>3 · Technical escalation</strong><span>Confirm Field CTO and SE support for the next checkpoint.</span></li></ol></section><section className="rsm-section"><h2>Participants</h2>{participantRows.map((person) => <article className="brief-row" key={person.membershipId}><div><strong>{person.displayName}</strong><small>{person.role.replaceAll("_", " ")}</small></div><span>Required</span></article>)}</section></div><section className="rsm-section"><h2>Create the working session</h2><p>AROS carries the agenda, evidence, owners, decisions, and outcomes into the Digital Twin.</p><CreateStrategic2x2 accountId={accountId} opportunityId={deal?.id ?? "opp-coinbase-renewal"} participants={participantRows.map((person) => ({ membershipId: person.membershipId, participantRole: person.role }))} /></section></main>;
}
