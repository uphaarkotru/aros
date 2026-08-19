import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { query } from "@/db/client";
import { getAccountOperatingTimeline } from "@/db/operating-repository";
import { EvidencePanel } from "@/components/revenue-operating";
import { OperatingPage } from "@/components/operating-page";

export default async function AccountTimelinePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const identity = await requireIdentity(),
    { accountId } = await params;
  if (!identity.scope?.accountIds.includes(accountId)) notFound();
  const [account, events] = await Promise.all([
    query(
      `SELECT id,name,domain,segment,status FROM accounts WHERE organization_id=$1 AND id=$2`,
      [identity.organization.id, accountId],
    ),
    getAccountOperatingTimeline(identity.organization.id, accountId),
  ]);
  if (!account.rows[0]) notFound();
  return (
    <OperatingPage activeSection="accounts">
      <main className="rsm-today">
        <header className="rsm-hero">
          <div>
            <span className="eyebrow">
              REVENUE DIGITAL TWIN · INSTITUTIONAL MEMORY
            </span>
            <h1>{account.rows[0].name}</h1>
            <p>
              Unified operating timeline of signals, insights, decisions,
              actions, commitments, cadence events, and outcomes.
            </p>
          </div>
          <Link className="secondary-button" href="/accounts">
            Back to accounts →
          </Link>
        </header>
        <section className="rsm-section">
          <div className="section-heading">
            <div>
              <h2>Account operating timeline</h2>
              <p>{events.length} persisted lifecycle events · newest first</p>
            </div>
          </div>
          <ol className="operating-timeline">
            {events.map((event) => (
              <li key={`${event.kind}-${event.id}`}>
                <time>{new Date(event.occurredAt).toLocaleDateString()}</time>
                <div className="timeline-event">
                  <span className="operating-stage">{event.kind}</span>
                  <h3>{event.title}</h3>
                  <p>{event.summary}</p>
                  {event.ownerName && <small>Owner · {event.ownerName}</small>}
                  {event.status && <small>Status · {event.status}</small>}
                  {event.kind === "SIGNAL" || event.kind === "INSIGHT" ? (
                    <EvidencePanel
                      evidence={[event.summary]}
                      freshness={new Date(
                        event.occurredAt,
                      ).toLocaleDateString()}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {!events.length && (
            <p className="empty-brief">
              No operating events have been recorded for this account yet.
            </p>
          )}
        </section>
      </main>
    </OperatingPage>
  );
}
