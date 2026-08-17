"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
const next: Record<string, string[]> = {
  OPEN: ["ACKNOWLEDGED", "DISMISSED"],
  ACKNOWLEDGED: ["ACTIONED", "DISMISSED"],
  ACTIONED: ["MONITORING", "RESOLVED"],
  MONITORING: ["ACTIONED", "RESOLVED"],
};
export function InterventionActions({
  id,
  status,
  version,
}: {
  id: string;
  status: string;
  version: number;
}) {
  const router = useRouter(),
    [message, setMessage] = useState("");
  async function update(value: string) {
    setMessage("Saving…");
    const response = await fetch(`/api/manager-interventions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: value, expectedVersion: version }),
      }),
      body = await response.json();
    setMessage(response.ok ? "Saved" : (body.error ?? "Unable to update"));
    if (response.ok) router.refresh();
  }
  return (
    <div className="intervention-actions">
      {(next[status] ?? []).map((value) => (
        <button key={value} onClick={() => update(value)}>
          {value.replaceAll("_", " ")}
        </button>
      ))}
      {message && <small>{message}</small>}
    </div>
  );
}
