import Link from "next/link";
import { requireIdentity } from "@/auth/guards.server";
import { revenueRepository } from "@/db/revenue-repository";
import { OperatingPage } from "@/components/operating-page";
import { ActionControls } from "./action-controls";

export default async function ActionsPage() {
  const identity = await requireIdentity(), actions = await revenueRepository.listActions(identity.organization.id, identity.scope?.accountIds ?? []);
  const own = actions.filter((action) => action.assignedMembershipId === identity.membership.id), leadership = actions.filter((action) => action.type.includes("LEADERSHIP") || action.type.includes("EXECUTIVE")), team = actions.filter((action) => !own.includes(action) && !leadership.includes(action));
  const section = (title: string, items: typeof actions) => <section className="rsm-section"><h2>{title}</h2>{items.length ? items.map((action) => <article className="brief-row action-row-card" key={action.id}><div><strong>{action.recommendation}</strong><small>{action.type} · {action.accountId ?? action.opportunityId ?? "Revenue motion"}</small><ActionControls id={action.id} status={action.status} /></div><span>{action.status}</span></article>) : <p className="empty-brief">No actions in this view.</p>}</section>;
  return <OperatingPage><main className="rsm-today"><header className="rsm-hero"><div><span className="eyebrow">ACTION CONTROL</span><h1>Actions</h1><p>Review, approve, complete, or dismiss the next actions owned by your revenue team.</p></div></header>{section("My actions", own)}{section("Team actions", team)}{section("Leadership actions", leadership)}<Link className="secondary-button" href="/today">Return to Today →</Link></main></OperatingPage>;
}
