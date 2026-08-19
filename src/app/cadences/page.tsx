import Link from "next/link";
import { requireIdentity } from "@/auth/guards.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
const meetingTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
      }).format(new Date(value))
    : "Scheduling needed";

interface CadenceListItem {
  id: string;
  status: string;
  scope: string;
  scheduled_at: string | null;
  preparation_summary: string;
  template_code: string;
  template_name: string;
  opportunity_name: string | null;
  account_name: string | null;
  participant_names: string | null;
  agenda_count: number;
  carry_forward_count: number;
}

function CadenceCard({ item }: { item: CadenceListItem }) {
  return (
    <Link className="cadence-meeting-card" href={`/cadences/${item.id}`}>
      <div className="cadence-meeting-time">
        <span>{item.status}</span>
        <strong>{meetingTime(item.scheduled_at)}</strong>
      </div>
      <div className="cadence-meeting-body">
        <span className="eyebrow">
          {item.template_code.replaceAll("_", " ")}
        </span>
        <h3>{item.template_name}</h3>
        <p>{item.opportunity_name ?? item.account_name ?? item.scope}</p>
        <small>
          {item.participant_names ?? "Participants being assembled"}
        </small>
        <blockquote>{item.preparation_summary}</blockquote>
      </div>
      <dl className="cadence-meeting-facts">
        <div>
          <dt>AI agenda</dt>
          <dd>{item.agenda_count} items</dd>
        </div>
        <div>
          <dt>Carry-forward</dt>
          <dd>{item.carry_forward_count} actions</dd>
        </div>
      </dl>
      <span className="open-arrow">→</span>
    </Link>
  );
}
export default async function Page() {
  const identity = await requireIdentity(),
    effectiveMembership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    items = cadenceRepository
      ? await cadenceRepository.listCadences(
          identity.organization.id,
          effectiveMembership?.id ?? identity.membership.id,
        )
      : [];
  return (
    <main className="rsm-today operating-light">
      <header className="rsm-hero">
        <div>
          <span className="eyebrow">UNIFIED REVENUE CADENCE</span>
          <h1>Cadences</h1>
          <p>
            AI-prepared operating sessions, decisions, commitments, and
            persistent revenue-motion memory.
          </p>
        </div>
      </header>
      <section className="rsm-section cadence-calendar">
        <div className="section-heading">
          <div>
            <h2>Upcoming meetings</h2>
            <p>
              Prepared from current signals, open decisions, and prior action
              items.
            </p>
          </div>
          <span>
            {items.filter((item) => item.status !== "COMPLETED").length}{" "}
            upcoming
          </span>
        </div>
        {items.some((item) => item.status !== "COMPLETED") ? (
          <div className="cadence-meeting-list">
            {items
              .filter((item) => item.status !== "COMPLETED")
              .map((item) => (
                <CadenceCard item={item} key={item.id} />
              ))}
          </div>
        ) : (
          <p className="empty-brief">
            No upcoming cadence meetings are currently assigned to you.
          </p>
        )}
      </section>
      <section className="rsm-section">
        <h2>Recent cadence memory</h2>
        <p className="scope-note">
          Completed meetings remain available so AROS can carry decisions and
          commitments into the next conversation.
        </p>
        {items
          .filter((item) => item.status === "COMPLETED")
          .map((item) => (
            <CadenceCard item={item} key={item.id} />
          ))}
      </section>
    </main>
  );
}
