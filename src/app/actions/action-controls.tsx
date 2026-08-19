"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActionControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const act = async (action: "approve" | "execute" | "dismiss") => {
    setBusy(true);
    const response = await fetch(`/api/decisions/${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Action ${action}d successfully.` : (body.error ?? "Action could not be updated."));
    setBusy(false);
    if (response.ok) router.refresh();
  };
  const normalized = status.toUpperCase();
  return <div className="action-panel action-controls"><button className="primary-button" disabled={busy || normalized === "APPROVED" || normalized === "EXECUTED"} onClick={() => void act("approve")}>Approve</button><button className="secondary-button" disabled={busy || normalized !== "APPROVED"} onClick={() => void act("execute")}>Complete action</button><button className="secondary-button" disabled={busy || normalized === "DISMISSED" || normalized === "EXECUTED"} onClick={() => void act("dismiss")}>Dismiss</button>{message && <p aria-live="polite">{message}</p>}</div>;
}
