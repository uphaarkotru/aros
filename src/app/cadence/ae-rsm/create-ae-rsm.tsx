"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateAeRsm({
  accountId,
  opportunityId,
  participants,
}: {
  accountId: string;
  opportunityId: string;
  participants: Array<{ membershipId: string; participantRole: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function create() {
    setBusy(true);
    setMessage("Preparing the AE–RSM 1:1…");
    const response = await fetch("/api/cadences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        opportunityId,
        templateCode: "MANAGER_1_ON_1",
        scope: "INTERNAL",
        participants: participants.map((item) => ({
          membershipId: item.membershipId,
          participantRole: item.participantRole,
          participationType: "INTERNAL",
          required: true,
        })),
        agenda: [
          { type: "PRIORITY", priority: 1, title: "Coinbase renewal priority", rationale: "Security progress and executive engagement are the clearest leading indicators of renewal risk.", recommendedDiscussion: "Name the smallest seller action that can change the next customer checkpoint.", recommendedDecision: "Agree the recovery commitment and owner.", visibility: "INTERNAL_ONLY" },
          { type: "COACHING", priority: 2, title: "Executive sponsor plan", rationale: "Recent executive engagement is below the level associated with healthy renewals.", recommendedDiscussion: "Coach the AE on a specific executive re-engagement path.", recommendedDecision: "Decide whether manager or Field CTO support is needed.", visibility: "INTERNAL_ONLY" },
          { type: "COMMITMENT", priority: 3, title: "Commitment review", rationale: "Overdue commitments need a dated recovery plan and visible evidence.", recommendedDiscussion: "Review what improved, worsened, is new, or is resolved.", recommendedDecision: "Create one accountable next action with a due date.", visibility: "INTERNAL_ONLY" },
        ],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error ?? "The AE–RSM 1:1 could not be prepared.");
      setBusy(false);
      return;
    }
    router.push(`/cadences/${body.session?.id ?? body.id}`);
  }
  return <div className="action-panel"><button className="primary-button" disabled={busy} onClick={() => void create()}>{busy ? "Preparing…" : "Prepare AE–RSM 1:1"}</button>{message && <p aria-live="polite">{message}</p>}</div>;
}
