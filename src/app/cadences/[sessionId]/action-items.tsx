"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export interface ActionItemView {
  id: string;
  description: string;
  ownerName: string | null;
  dueAt: string | null;
  status: string;
  expectedOutcome: string | null;
  version: number;
  sourceCadence: string | null;
}
export interface ActionOwnerOption {
  id: string;
  name: string;
}

const statuses = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "MISSED",
  "CANCELLED",
] as const;

function ActionRow({ item }: { item: ActionItemView }) {
  const router = useRouter(),
    [status, setStatus] = useState(item.status),
    [evidence, setEvidence] = useState(""),
    [message, setMessage] = useState("");
  return (
    <article className="cadence-action-row">
      <div>
        <strong>{item.description}</strong>
        <small>
          {item.ownerName ?? "Unassigned"}
          {item.dueAt
            ? ` · Due ${new Date(item.dueAt).toLocaleDateString()}`
            : " · No due date"}
          {item.sourceCadence ? ` · From ${item.sourceCadence}` : ""}
        </small>
        {item.expectedOutcome && <p>Expected: {item.expectedOutcome}</p>}
      </div>
      <label>
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {statuses.map((value) => (
            <option value={value} key={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Update evidence
        <input
          value={evidence}
          placeholder="What changed?"
          onChange={(event) => setEvidence(event.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={async () => {
          setMessage("Saving…");
          const response = await fetch(`/api/commitments/${item.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                expectedVersion: item.version,
                status,
                completionEvidence: evidence.trim()
                  ? { update: evidence.trim() }
                  : null,
              }),
            }),
            body = await response.json().catch(() => ({}));
          setMessage(response.ok ? "Saved" : (body.error ?? "Unable to save"));
          if (response.ok) router.refresh();
        }}
      >
        Save update
      </button>
      {message && <small role="status">{message}</small>}
    </article>
  );
}

export function ActionItems({
  sessionId,
  items,
  owners,
  defaultOwnerMembershipId,
  external,
}: {
  sessionId: string;
  items: ActionItemView[];
  owners: ActionOwnerOption[];
  defaultOwnerMembershipId: string;
  external: boolean;
}) {
  const router = useRouter(),
    [message, setMessage] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form),
      dueAt = String(data.get("dueAt") ?? ""),
      response = await fetch(`/api/cadences/${sessionId}/commitments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          description: data.get("description"),
          ownerMembershipId: data.get("ownerMembershipId"),
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          expectedOutcome: data.get("expectedOutcome"),
          impact: data.get("impact"),
          visibility: external ? data.get("visibility") : "INTERNAL_ONLY",
        }),
      }),
      body = await response.json().catch(() => ({}));
    setMessage(
      response.ok ? "Action item created." : (body.error ?? "Unable to save"),
    );
    if (response.ok) {
      form.reset();
      router.refresh();
    }
  }
  return (
    <section className="rsm-section cadence-actions">
      <span className="eyebrow">ACTIONS &amp; COMMITMENTS</span>
      <h2>Action items</h2>
      <p className="scope-note">
        Capture ownership during the cadence and update earlier commitments as
        work progresses. Changes persist to the Revenue Digital Twin.
      </p>
      {items.length ? (
        <div className="cadence-action-list">
          {items.map((item) => (
            <ActionRow item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="empty-brief">No action items have been captured yet.</p>
      )}
      <form className="cadence-action-create" onSubmit={create}>
        <h3>Capture a new action</h3>
        <label className="wide">
          Action
          <input name="description" required maxLength={500} />
        </label>
        <label>
          Owner
          <select
            name="ownerMembershipId"
            defaultValue={defaultOwnerMembershipId}
            required
          >
            {owners.map((owner) => (
              <option value={owner.id} key={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due
          <input name="dueAt" type="datetime-local" />
        </label>
        <label className="wide">
          Expected outcome
          <input name="expectedOutcome" />
        </label>
        <label>
          Impact
          <select name="impact" defaultValue="MEDIUM">
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </label>
        {external && (
          <label>
            Visibility
            <select name="visibility" defaultValue="EXTERNAL_SHAREABLE">
              <option value="EXTERNAL_SHAREABLE">External shareable</option>
              <option value="INTERNAL_ONLY">Internal only</option>
            </select>
          </label>
        )}
        <button type="submit">Add action item</button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
