import Link from "next/link";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { query } from "@/db/client";
import { getAccountOperatingTimeline } from "@/db/operating-repository";
import { EvidencePanel } from "@/components/revenue-operating";
import { CreateAeRsm } from "./create-ae-rsm";

export default async function AeRsmCadencePage() {
  const identity = await requireIdentity();
  if (identity.effectiveRole !== "AE" && identity.effectiveRole !== "RSM") redirect("/access-denied");
  const accountId = identity.scope?.accountIds.includes("acct-coinbase") ? "acct-coinbase" : identity.scope?.accountIds[0];
  if (!accountId) return <main className="rsm-today"><h1>AE–RSM 1:1 unavailable</h1><p>No authorized account scope is available.</p></main>;
  const [account, opportunity, timeline, commitments, people] = await Promise.all([
    query<{ name: string }>(`SELECT name FROM accounts WHERE organization_id=$1 AND id=$2`, [identity.organization.id, accountId]),
    query<{ id: string; name: string; amount: number }>(`SELECT id,name,amount::float8 AS amount FROM opportunities WHERE organization_id=$1 AND account_id=$2 ORDER BY amount DESC LIMIT 1`, [identity.organization.id, accountId]),
    getAccountOperatingTimeline(identity.organization.id, accountId),
    query<{ id: string; description: string; status: string; dueAt: string | null; ownerName: string | null }>(`SELECT c.id,c.description,c.status,c.due_at AS "dueAt",u.display_name AS "ownerName" FROM commitments c LEFT JOIN organization_memberships m ON(m.organization_id=c.organization_id AND m.id=c.owner_membership_id) LEFT JOIN users u ON(u.id=m.user_id) WHERE c.organization_id=$1 AND c.account_id=$2 AND c.status NOT IN('COMPLETED','CANCELLED') ORDER BY c.due_at NULLS LAST LIMIT 8`, [identity.organization.id, accountId]),
    query<{ membershipId: string; displayName: string }>(`SELECT m.id AS "membershipId",u.display_name AS "displayName" FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.id IN ('membership-org-cognivit-demo-user-ae-sarah','membership-org-cognivit-demo-user-rsm-mark')`, [identity.organization.id]),
  ]);
  const deal = opportunity.rows[0];
  const roleByMembership = new Map([["membership-org-cognivit-demo-user-ae-sarah", "AE"], ["membership-org-cognivit-demo-user-rsm-mark", "RSM"]]);
  const participantRows = people.rows.map((person) => ({ ...person, role: roleByMembership.get(person.membershipId) ?? "REVENUE_TEAM" }));
  const evidence = timeline.filter((item) => ["SIGNAL", "INSIGHT"].includes(item.kind)).slice(0, 4).map((item) => item.summary);
  return <main className="rsm-today"><header className="rsm-hero"><div><span className="eyebrow">SELLER MANAGEMENT CADENCE</span><h1>AE–RSM Weekly 1:1</h1><p>{account.rows[0]?.name ?? "Coinbase"} · Sarah Chen + Mark Davis · coaching and execution improvement</p></div><Link className="secondary-button" href={`/accounts/${accountId}/timeline`}>Open account timeline →</Link></header><section className="rsm-section"><h2>Why this meeting exists</h2><p>AROS prepared this 1:1 because renewal execution risk is increasing and the seller needs a dated recovery plan.</p><EvidencePanel evidence={evidence.length ? evidence : ["Security review milestone delayed", "Executive engagement is declining", "Economic buyer interaction is missing"]} /></section><div className="rsm-grid"><section className="rsm-section"><h2>AI-prepared agenda</h2><ol className="operating-list"><li><strong>1 · Revenue priorities</strong><span>Review Coinbase renewal risk, revenue impact, and next customer checkpoint.</span></li><li><strong>2 · Changes since last 1:1</strong><span>Separate what improved, worsened, is new, and is resolved.</span></li><li><strong>3 · Coaching and decisions</strong><span>Choose the executive sponsor path and the smallest action that changes the outcome.</span></li></ol></section><section className="rsm-section"><h2>Participants</h2>{participantRows.map((person) => <article className="brief-row" key={person.membershipId}><div><strong>{person.displayName}</strong><small>{person.role}</small></div><span>Required</span></article>)}</section></div><section className="rsm-section"><h2>Commitments to review</h2>{commitments.rows.length ? commitments.rows.map((item) => <article className="brief-row" key={item.id}><div><strong>{item.description}</strong><small>{item.ownerName ?? "Unassigned"}{item.dueAt ? ` · due ${new Date(item.dueAt).toLocaleDateString()}` : ""}</small></div><span>{item.status}</span></article>) : <p className="empty-brief">No open commitments are currently attached.</p>}</section><section className="rsm-section"><h2>Prepare the working session</h2><p>Complete the meeting to persist coaching, decisions, commitments, and outcomes into the Revenue Digital Twin.</p><CreateAeRsm accountId={accountId} opportunityId={deal?.id ?? "opp-coinbase-renewal"} participants={participantRows.map((person) => ({ membershipId: person.membershipId, participantRole: person.role }))} /></section></main>;
}
