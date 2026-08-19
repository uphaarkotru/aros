import Link from "next/link";
import { requireIdentity } from "@/auth/guards.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { getMembership } from "@/auth/tenant-model";
import { identityRepository } from "@/auth/repository.server";
import { OperatingPage } from "@/components/operating-page";

export default async function MeetingsPage() {
  const identity = await requireIdentity(), membership = getMembership(identityRepository, identity.viewUser.id, identity.organization.id), meetings = cadenceRepository ? await cadenceRepository.listCadences(identity.organization.id, membership?.id ?? identity.membership.id) : [];
  return <OperatingPage><main className="rsm-today"><header className="rsm-hero"><div><span className="eyebrow">CADENCE CONTROL</span><h1>Meetings</h1><p>Upcoming cadences, completed operating memory, and required preparation.</p></div></header><section className="rsm-section"><h2>Upcoming and completed cadences</h2>{meetings.map((meeting) => <Link className="cadence-meeting-card" href={`/cadences/${meeting.id}`} key={meeting.id}><div className="cadence-meeting-body"><span className="eyebrow">{meeting.template_code.replaceAll("_", " ")}</span><h3>{meeting.template_name}</h3><p>{meeting.opportunity_name ?? meeting.account_name ?? meeting.scope}</p><small>{meeting.status} · {meeting.agenda_count} agenda items · {meeting.carry_forward_count} carry-forward actions</small></div></Link>)}{!meetings.length && <p className="empty-brief">No meetings require preparation.</p>}</section></main></OperatingPage>;
}
