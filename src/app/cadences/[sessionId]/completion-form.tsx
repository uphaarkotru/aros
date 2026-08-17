"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function CompletionForm({
  sessionId,
  version,
  external,
  ownerMembershipId,
}: {
  sessionId: string;
  version: number;
  external: boolean;
  ownerMembershipId: string;
}) {
  const router = useRouter(),
    [message, setMessage] = useState("");
  return (
    <form
      className="cadence-completion"
      onSubmit={async (event) => {
        event.preventDefault();
        setMessage("Completing cadence…");
        const data = new FormData(event.currentTarget),
          decision = String(data.get("decision") ?? "").trim(),
          commitment = String(data.get("commitment") ?? "").trim(),
          outcome = String(data.get("outcome") ?? "").trim(),
          visibility = external ? "EXTERNAL_SHAREABLE" : "INTERNAL_ONLY",
          response = await fetch(`/api/cadences/${sessionId}/complete`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              expectedVersion: version,
              internalSummary: String(data.get("internalSummary") ?? ""),
              externalSafeSummary: external
                ? String(data.get("externalSafeSummary") ?? "")
                : "",
              decisions: decision
                ? [{ type: "CADENCE_DECISION", decision, visibility }]
                : [],
              commitments: commitment
                ? [
                    {
                      idempotencyKey: `${sessionId}:${crypto.randomUUID()}`,
                      ownerMembershipId,
                      description: commitment,
                      visibility,
                      impact: "MEDIUM",
                    },
                  ]
                : [],
              outcomes: outcome
                ? [
                    {
                      type: "CADENCE_OUTCOME",
                      description: outcome,
                      visibility,
                    },
                  ]
                : [],
            }),
          }),
          body = await response.json();
        setMessage(
          response.ok
            ? "Cadence completed and written to the Revenue Digital Twin."
            : (body.error ?? "Completion failed"),
        );
        if (response.ok) router.refresh();
      }}
    >
      <h2>Complete cadence</h2>
      <label>
        Internal summary
        <textarea name="internalSummary" required />
      </label>
      {external && (
        <label>
          External-safe summary
          <textarea name="externalSafeSummary" required />
        </label>
      )}
      <label>
        Decision
        <input name="decision" />
      </label>
      <label>
        Commitment
        <input name="commitment" />
      </label>
      <label>
        Outcome
        <input name="outcome" />
      </label>
      <button type="submit">Complete cadence</button>
      {message && <p>{message}</p>}
    </form>
  );
}
