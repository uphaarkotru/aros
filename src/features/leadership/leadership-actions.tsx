"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeadershipActions({
  interventionId,
  assessmentId,
  canApprove,
}: {
  interventionId: string;
  assessmentId: string;
  canApprove: boolean;
}) {
  const router = useRouter(),
    [message, setMessage] = useState("");
  async function post(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setMessage(
      response.ok ? "Decision recorded and Twin updated." : result.error,
    );
    if (response.ok) router.refresh();
  }
  return (
    <div className="leadership-actions">
      {canApprove && (
        <button
          onClick={() =>
            void post(
              `/api/leadership/interventions/${encodeURIComponent(interventionId)}/approve`,
              {},
            )
          }
        >
          Approve leadership intervention
        </button>
      )}
      <button
        className="secondary"
        onClick={() =>
          void post(
            `/api/forecast-assessments/${encodeURIComponent(assessmentId)}/review`,
            { action: "REQUEST_MANAGER_REVIEW" },
          )
        }
      >
        Request manager review
      </button>
      <button
        className="secondary"
        onClick={() =>
          void post(
            `/api/forecast-assessments/${encodeURIComponent(assessmentId)}/review`,
            { action: "KEEP_CURRENT" },
          )
        }
      >
        Keep current human forecast
      </button>
      <p aria-live="polite">{message}</p>
    </div>
  );
}
