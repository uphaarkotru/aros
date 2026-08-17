import Link from "next/link";
import { roleDisplay } from "@/auth/permissions";
import type { RevenueRole } from "@/auth/types";
import { requireIdentity } from "@/auth/guards.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { revenueRepository } from "@/db/revenue-repository";
import { cadenceRepository } from "@/db/cadence-repository";
const copy: Partial<
  Record<RevenueRole, { headline: string; items: string[] }>
> = {
  SDR: {
    headline: "Turn signals into qualified conversations",
    items: [
      "Prospecting intelligence",
      "Assigned account signals",
      "Today’s approved outreach",
    ],
  },
  AE: {
    headline: "Prioritize the decisions that move revenue",
    items: ["Account intelligence", "Recommended actions", "Commitments due"],
  },
  RSM: {
    headline: "Coach the team where judgment matters",
    items: [
      "Manager decision queue",
      "Seller commitments",
      "Team forecast risk",
    ],
  },
  SALES_ENGINEER: {
    headline: "Advance the technical decision",
    items: [
      "Technical opportunity context",
      "POC and security blockers",
      "Technical commitments",
    ],
  },
  SALES_ENGINEER_MANAGER: {
    headline: "Coordinate technical revenue capacity",
    items: [
      "SE opportunity portfolio",
      "Technical risk",
      "Resource allocation",
    ],
  },
  PARTNER_SALES: {
    headline: "Orchestrate partner-influenced revenue",
    items: ["Partner intelligence", "Co-sell actions", "Shared commitments"],
  },
  VP_SALES: {
    headline: "See execution patterns across your organization",
    items: [
      "Manager and team rollup",
      "Forecast movement",
      "Resource allocation",
    ],
  },
  CRO: {
    headline: "Lead the revenue system",
    items: [
      "Enterprise forecast",
      "Executive intelligence",
      "Governance and learning",
    ],
  },
};
const meetingTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Scheduling needed";

export async function RoleToday({
  role,
  name,
}: {
  role: RevenueRole;
  name: string;
}) {
  const data = copy[role] ?? {
      headline:
        "Collaborate on the revenue motions where your expertise matters",
      items: [
        "Assigned revenue context",
        "Cross-functional actions",
        "Shared commitments",
      ],
    },
    identity = await requireIdentity(),
    membership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    accountIds = identity.scope?.accountIds ?? [],
    allowedAccounts = new Set(accountIds),
    [allAccounts, decisions, cadences] = await Promise.all([
      revenueRepository.listAccounts(identity.organization.id),
      revenueRepository.listActions(identity.organization.id, accountIds),
      cadenceRepository && membership
        ? cadenceRepository.listCadences(
            identity.organization.id,
            membership.id,
          )
        : [],
    ]),
    accounts = allAccounts.filter((account) => allowedAccounts.has(account.id)),
    upcomingCadences = cadences
      .filter((cadence) => cadence.status !== "COMPLETED")
      .slice(0, 4),
    pendingDecisions = decisions
      .filter((decision) =>
        ["PENDING", "APPROVED", "EDITED", "SNOOZED"].includes(decision.status),
      )
      .slice(0, 4);
  return (
    <main className="role-today">
      <h1>Good morning, {name}</h1>
      <p>{data.headline}</p>
      <section className="role-cards">
        {data.items.map((item, index) => (
          <article key={item}>
            <span>0{index + 1}</span>
            <h2>{item}</h2>
            <p>
              AI has prepared scoped context for your {roleDisplay[role]}{" "}
              decisions.
            </p>
          </article>
        ))}
      </section>
      <section className="role-data-section">
        <header>
          <div>
            <span className="eyebrow">LIVE REVENUE CONTEXT</span>
            <h2>My revenue motions</h2>
          </div>
          <Link href="/accounts">Open accounts →</Link>
        </header>
        <div className="role-data-list">
          {accounts.length ? (
            accounts.slice(0, 5).map((account) => (
              <Link href={`/accounts/${account.id}`} key={account.id}>
                <strong>{account.name}</strong>
                <span>{account.segment ?? "Enterprise"}</span>
                <small>{account.status}</small>
              </Link>
            ))
          ) : (
            <p>No active revenue motions are in your jurisdiction.</p>
          )}
        </div>
      </section>
      <section className="role-data-section">
        <header>
          <div>
            <span className="eyebrow">AI-PREPARED CADENCE</span>
            <h2>Upcoming meetings</h2>
          </div>
          <Link href="/cadences">Open unified cadence →</Link>
        </header>
        <div className="role-data-list">
          {upcomingCadences.length ? (
            upcomingCadences.map((cadence) => (
              <Link href={`/cadences/${cadence.id}`} key={cadence.id}>
                <strong>{cadence.template_name}</strong>
                <span>
                  {cadence.opportunity_name ??
                    cadence.account_name ??
                    cadence.scope}
                </span>
                <small>
                  {meetingTime(cadence.scheduled_at)} · {cadence.agenda_count}{" "}
                  AI agenda item{cadence.agenda_count === 1 ? "" : "s"} ·{" "}
                  {cadence.carry_forward_count} previous action
                  {cadence.carry_forward_count === 1 ? "" : "s"}
                </small>
              </Link>
            ))
          ) : (
            <p>No prepared cadence meetings are assigned to you.</p>
          )}
        </div>
      </section>
      <section className="role-data-section">
        <header>
          <div>
            <span className="eyebrow">HUMAN DECISIONS</span>
            <h2>Decisions requiring context</h2>
          </div>
        </header>
        <div className="role-data-list">
          {pendingDecisions.length ? (
            pendingDecisions.map((decision) => (
              <article key={decision.id}>
                <strong>{decision.recommendation}</strong>
                <span>{decision.type.replaceAll("_", " ")}</span>
                <small>{decision.status}</small>
              </article>
            ))
          ) : (
            <p>No material decisions are waiting in your scoped accounts.</p>
          )}
        </div>
      </section>
    </main>
  );
}
