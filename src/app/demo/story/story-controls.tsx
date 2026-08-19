"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
const steps = ["HEALTHY_STATE","RISK_DETECTED","MANAGER_INTERVENTION_REQUIRED","2X2_EXECUTED","FORECAST_RISK_UPDATED","EXECUTIVE_INTERVENTION_REQUIRED"] as const;
export function StoryControls({ state, version }: { state: string; version: number }) {
  const router = useRouter(), [busy, setBusy] = useState(false), index = Math.max(0, steps.indexOf(state as (typeof steps)[number]));
  async function transition(next: string) { setBusy(true); try { await fetch("/api/demo/story/transition", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: next, expectedVersion: version }) }); router.refresh(); } finally { setBusy(false); } }
  async function reset() { setBusy(true); try { await fetch("/api/demo/coinbase/reset", { method: "POST" }); router.refresh(); } finally { setBusy(false); } }
  return <div className="story-controls"><div className="story-progress" aria-label="Demo story progress">{steps.map((step, stepIndex) => <span className={stepIndex <= index ? "complete" : ""} key={step}>{stepIndex + 1}</span>)}</div><p>Step {index + 1} of {steps.length}: {state.replaceAll("_", " ")}</p><div className="action-panel"><button className="secondary-button" disabled={busy} onClick={reset}>Reset story</button>{steps[index + 1] && <button className="primary-button" disabled={busy} onClick={() => transition(steps[index + 1])}>Advance story →</button>}</div></div>;
}
