"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateStrategic2x2({
  accountId,
  opportunityId,
  participants,
}: {
  accountId: string;
  opportunityId: string;
  participants: Array<{
    membershipId: string;
    participantRole: string;
  }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function create() {
    setBusy(true);
    setMessage("Preparing the 2x2…");
    const response = await fetch("/api/cadences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        opportunityId,
        templateCode: "CROSS_FUNCTIONAL_2X2",
        scope: "INTERNAL",
        participants: participants.map((item) => ({
          membershipId: item.membershipId,
          participantRole: item.participantRole,
          participationType: "INTERNAL",
          required: true,
        })),
        agenda: [
          { type: "RISK", priority: 1, title: "Security milestone recovery", rationale: "The security review is fourteen days late and is the highest-confidence renewal risk.", recommendedDiscussion: "Confirm the owner and customer checkpoint.", recommendedDecision: "Approve technical escalation.", visibility: "INTERNAL_ONLY" },
          { type: "EXECUTIVE", priority: 2, title: "Executive sponsor plan", rationale: "Executive engagement and economic-buyer access are weakening.", recommendedDiscussion: "Choose the executive sponsor and customer message.", recommendedDecision: "Assign an executive sponsor.", visibility: "INTERNAL_ONLY" },
          { type: "ACTION", priority: 3, title: "Recovery plan and owners", rationale: "Convert the discussion into dated commitments with evidence.", recommendedDiscussion: "Name owners, due dates, and expected outcomes.", recommendedDecision: "Create the recovery actions.", visibility: "INTERNAL_ONLY" },
        ],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "The 2x2 could not be prepared.");
      setBusy(false);
      return;
    }
    router.push(`/cadences/${body.session?.id ?? body.id}`);
  }
  return <div className="action-panel"><button className="primary-button" disabled={busy} onClick={() => void create()}> {busy ? "Preparing…" : "Run strategic 2x2"} </button>{message && <p aria-live="polite">{message}</p>}</div>;
}
