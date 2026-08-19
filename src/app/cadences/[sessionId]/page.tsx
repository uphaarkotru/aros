import Link from "next/link";
import { notFound } from "next/navigation";
import { requireIdentity } from "@/auth/guards.server";
import { cadenceRepository } from "@/db/cadence-repository";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { CompletionForm } from "./completion-form";
import { ActionItems } from "./action-items";
import { ApplicationShell } from "@/components/application-shell";

const meetingTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Los_Angeles",
        timeZoneName: "short",
      }).format(new Date(value))
    : "Time to be scheduled";

const signalSummary = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as Record<string, unknown>;
  return String(
    value.summary ?? value.message ?? value.description ?? fallback,
  );
};
export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const identity = await requireIdentity(),
    effectiveMembership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    ),
    { sessionId } = await params,
    data = cadenceRepository
      ? await cadenceRepository.getCadence(
          identity.organization.id,
          sessionId,
          effectiveMembership?.id ?? identity.membership.id,
        )
      : null;
  if (!data) notFound();
  const external = data.session.scope !== "INTERNAL";
  const owners = data.participants
      .filter((participant) => participant.membership_id)
      .map((participant) => ({
        id: String(participant.membership_id),
        name: String(participant.display_name),
      })),
    actions = [...data.commitments, ...data.carryForwardCommitments].map(
      (commitment) => ({
        id: String(commitment.id),
        description: String(commitment.description),
        ownerName: commitment.owner_name ? String(commitment.owner_name) : null,
        dueAt: commitment.due_at
          ? new Date(commitment.due_at).toISOString()
          : null,
        status: String(commitment.status),
        expectedOutcome: commitment.expected_outcome
          ? String(commitment.expected_outcome)
          : null,
        version: Number(commitment.version),
        sourceCadence: commitment.source_cadence
          ? String(commitment.source_cadence)
          : null,
      }),
    );
  return (
    <ApplicationShell
      active="cadences"
      role={identity.effectiveRole ?? undefined}
    >
      <main className="rsm-today operating-light">
        <Link className="back-link" href="/today">
          ← Today
        </Link>
        <header className="rsm-hero">
          <div>
            <span className="eyebrow">
              {data.session.scope} CADENCE · {data.session.status}
            </span>
            <h1>{data.session.template_name}</h1>
            <p>{data.session.preparation_summary}</p>
            <div className="cadence-hero-time">
              {meetingTime(data.session.scheduled_at)}
            </div>
          </div>
        </header>
        <section className="rsm-section">
          <span className="eyebrow">WHAT CHANGED</span>
          <h2>Signals shaping this meeting</h2>
          <p className="scope-note">
            AROS prepared this context from the shared revenue motion. It is not
            a blank meeting-notes form.
          </p>
          {data.signals.length ? (
            <div className="cadence-signal-grid">
              {data.signals.map((signal) => (
                <article className="cadence-signal" key={signal.id}>
                  <div>
                    <span>{signal.severity ?? "INFO"}</span>
                    <strong>{signal.type.replaceAll("_", " ")}</strong>
                  </div>
                  <p>
                    {signalSummary(
                      signal.payload,
                      "New revenue signal detected.",
                    )}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-brief">
              No new signals are attached to this motion.
            </p>
          )}
        </section>
        <div className="rsm-grid">
          <section className="rsm-section">
            <h2>AI-prepared agenda</h2>
            {data.agenda.map((item) => (
              <article className="agenda-card" key={item.id}>
                <div>
                  <span className="agenda-priority">
                    Priority {item.priority}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.rationale}</p>
                  {item.recommended_discussion && (
                    <small>
                      <strong>Discuss:</strong> {item.recommended_discussion}
                    </small>
                  )}
                  {item.recommended_decision && (
                    <small>
                      <strong>Decision:</strong> {item.recommended_decision}
                    </small>
                  )}
                </div>
                <span>{item.visibility.replaceAll("_", " ")}</span>
              </article>
            ))}
          </section>
          <section className="rsm-section">
            <h2>Participants</h2>
            {data.participants.map((item) => (
              <article className="brief-row" key={item.id}>
                <div>
                  <strong>{item.display_name ?? item.external_name}</strong>
                  <small>{item.participant_role}</small>
                </div>
                <span>{item.required ? "Required" : "Optional"}</span>
              </article>
            ))}
          </section>
        </div>
        <ActionItems
          sessionId={sessionId}
          items={actions}
          owners={owners}
          defaultOwnerMembershipId={
            owners.some(
              (owner) =>
                owner.id ===
                (effectiveMembership?.id ?? identity.membership.id),
            )
              ? (effectiveMembership?.id ?? identity.membership.id)
              : (owners[0]?.id ?? "")
          }
          external={external}
        />
        {data.session.template_code === "CROSS_FUNCTIONAL_2X2" && (
          <section className="rsm-section">
            <span className="eyebrow">HUMANS ALIGN ON ACTION</span>
            <h2>AI-generated decision queue</h2>
            <p>
              Review the underlying revenue decisions together. The 2x2 is the
              forum for alignment; it is not itself a decision.
            </p>
            {data.aiDecisions.length ? (
              data.aiDecisions.map((decision) => (
                <article className="brief-row" key={decision.id}>
                  <div>
                    <strong>
                      {String(
                        decision.metadata?.title ?? decision.recommendation,
                      )}
                    </strong>
                    <small>
                      {String(
                        decision.metadata?.summary ??
                          "Review evidence and align on the human action.",
                      )}
                    </small>
                  </div>
                  <span>{decision.status}</span>
                </article>
              ))
            ) : (
              <p className="empty-brief">
                No governed decisions currently require alignment.
              </p>
            )}
          </section>
        )}
        {data.session.status === "COMPLETED" ? (
          <section className="rsm-section">
            <h2>Structured memory</h2>
            <p>{data.session.internal_summary}</p>
            {external && (
              <>
                <h3>External-safe summary</h3>
                <p>{data.session.external_safe_summary}</p>
              </>
            )}
            <p>
              {data.decisions.length} decisions · {data.commitments.length}{" "}
              commitments · {data.outcomes.length} outcomes
            </p>
          </section>
        ) : (
          <CompletionForm
            sessionId={sessionId}
            version={data.session.version}
            external={external}
            ownerMembershipId={
              effectiveMembership?.id ?? identity.membership.id
            }
          />
        )}
      </main>
    </ApplicationShell>
  );
}
