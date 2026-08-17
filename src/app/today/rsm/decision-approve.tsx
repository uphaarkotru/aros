"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function DecisionApprove({ id }: { id: string }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const response = await fetch(`/api/decisions/${id}/approve`, {
              method: "POST",
            }),
            body = await response.json();
          if (!response.ok) {
            setError(body.error ?? "Approval failed");
            setBusy(false);
            return;
          }
          router.refresh();
        }}
      >
        {busy ? "Creating cadence…" : "Approve"}
      </button>
      {error && <small>{error}</small>}
    </div>
  );
}
