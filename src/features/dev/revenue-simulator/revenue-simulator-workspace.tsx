"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  PreRunCostEstimate,
  SimulationStepAnalytics,
} from "@/domain/simulation/analytics-types";
import type {
  SimulationEventType,
  SimulationExecutionMode,
  SimulationReview,
  SimulationSession,
} from "@/domain/simulation/types";
import { simulationEventTypes } from "@/domain/simulation/types";
import {
  coinbaseSimulationScenarios,
  getSimulationScenario,
} from "@/data/simulation-scenarios/coinbase-renewal";
import { createSimulationEvent } from "@/revenue-simulator/events";
import {
  addSimulationReview,
  createSimulationSession,
  getSimulationStateAtStep,
  injectSimulationEvent,
  resetSimulationSession,
  runSimulationStep,
} from "@/revenue-simulator/runner";
import { calculateSimulationQualityScorecard } from "@/revenue-simulator/review";
import { exportScenario, importScenario } from "@/revenue-simulator/serialization";
import {
  loadSimulationSessionAction,
  estimateLiveSimulationAction,
  runLiveSimulationAnalyticsAction,
  saveSimulationSessionAction,
} from "@/app/dev/revenue-simulator/actions";
import { attachSimulationAnalytics, compareCostQuality } from "@/revenue-simulator/analytics";

const pretty = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function RevenueSimulatorWorkspace({
  initialSession,
  preRunEstimate,
}: {
  initialSession: SimulationSession;
  preRunEstimate?: PreRunCostEstimate;
}) {
  const [session, setSession] = useState(() => attachSimulationAnalytics(initialSession));
  const [eventType, setEventType] = useState<SimulationEventType>("champion-left");
  const [severity, setSeverity] = useState("high");
  const [description, setDescription] = useState("");
  const [eventValue, setEventValue] = useState("");
  const [timeView, setTimeView] = useState<number | "baseline">("baseline");
  const [reviewScore, setReviewScore] = useState(4);
  const [reviewComments, setReviewComments] = useState("");
  const [status, setStatus] = useState("Ready to run a controlled simulation.");
  const [importValue, setImportValue] = useState("");
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [liveEstimate, setLiveEstimate] = useState(preRunEstimate);
  const [liveAnalytics, setLiveAnalytics] = useState<SimulationStepAnalytics>();
  const [pending, startTransition] = useTransition();
  const scenario = getSimulationScenario(session.scenarioId) ?? coinbaseSimulationScenarios[0]!;
  const selectedState = getSimulationStateAtStep(session, timeView);
  const latestStep = session.simulationSteps.at(-1);
  const scorecard = useMemo(
    () => calculateSimulationQualityScorecard(session.humanReviews),
    [session.humanReviews],
  );
  const liveComparison =
    liveAnalytics && latestStep?.analytics
      ? compareCostQuality({ baseline: latestStep.analytics, candidate: liveAnalytics })
      : undefined;

  const chooseScenario = (scenarioId: string) => {
    const next = getSimulationScenario(scenarioId)!;
    setSession(attachSimulationAnalytics(createSimulationSession({ scenario: next, executionMode: session.executionMode })));
    setTimeView("baseline");
    setStatus(`Loaded ${next.name}.`);
  };
  const chooseMode = (executionMode: SimulationExecutionMode) => {
    setSession(attachSimulationAnalytics(createSimulationSession({ scenario, executionMode })));
    setTimeView("baseline");
  };
  const queueEvent = () => {
    const nextDay = new Date(
      Date.parse(session.currentSimulatedTime) +
        (session.queuedEvents.length + 1) * 86_400_000,
    ).toISOString();
    const numeric = Number(eventValue);
    const event = createSimulationEvent({
      eventType,
      accountId: session.accountId,
      effectiveAt: nextDay,
      severity: severity as "informational" | "low" | "medium" | "high" | "critical",
      description: description || undefined,
      scenarioId: scenario.scenarioId,
      hypothesis: description || undefined,
      payload:
        eventType.includes("usage")
          ? { percentageChange: Number.isFinite(numeric) ? numeric / 100 : -0.18 }
          : eventType === "contract-value-changed"
            ? { amount: Number.isFinite(numeric) ? numeric : undefined }
            : eventType === "renewal-date-changed"
              ? { date: eventValue || undefined }
              : eventType.includes("news")
                ? { headline: description || pretty(eventType), value: eventValue }
                : {},
    });
    setSession(injectSimulationEvent(session, event));
    setStatus(`Queued ${pretty(eventType)}.`);
  };
  const runNext = () =>
    startTransition(async () => {
      const result = await runSimulationStep({ session, scenario });
      setSession(attachSimulationAnalytics(result));
      setTimeView(result.simulationSteps.at(-1)?.sequence ?? "baseline");
      setStatus(
        result.status === "failed"
          ? result.diagnostics.errors.at(-1) ?? "Simulation failed closed."
          : "Simulation step completed.",
      );
    });
  const runAll = () =>
    startTransition(async () => {
      let result = session;
      for (const predefined of scenario.predefinedEvents) {
        if (
          !result.queuedEvents.some((item) => item.eventId === predefined.eventId) &&
          !result.appliedEvents.some((item) => item.eventId === predefined.eventId)
        ) {
          result = injectSimulationEvent(result, predefined);
        }
      }
      while (result.queuedEvents.length && result.status !== "failed") {
        result = await runSimulationStep({ session: result, scenario });
      }
      setSession(attachSimulationAnalytics(result));
      setTimeView(result.simulationSteps.at(-1)?.sequence ?? "baseline");
      setStatus(result.status === "failed" ? "Simulation failed closed." : "All events completed.");
    });
  const saveReview = () => {
    const stepId = latestStep?.stepId;
    if (!stepId) return setStatus("Run a simulation step before reviewing it.");
    const review: SimulationReview = {
      reviewId: `review-${session.sessionId}-${session.humanReviews.length + 1}`,
      sessionId: session.sessionId,
      stepId,
      reviewer: "Senior AE — Development",
      reviewedAt: new Date().toISOString(),
      recommendationCorrectness: reviewScore,
      actionability: reviewScore,
      evidenceSufficiency: reviewScore,
      businessImpactAccuracy: reviewScore,
      confidenceAppropriateness: reviewScore,
      priorityAppropriateness: reviewScore,
      changeAppropriateness: reviewScore,
      wouldTakeAction: reviewScore >= 4,
      savedTimeEstimateMinutes: 30,
      decision: reviewScore >= 4 ? "appropriate" : "needs-improvement",
      flags: reviewScore < 3 ? ["underreacted"] : [],
      comments: reviewComments,
    };
    setSession(attachSimulationAnalytics(addSimulationReview(session, review)));
    setStatus("Senior AE review saved with the simulation.");
  };
  const refreshLiveEstimate = (confirmed: boolean) =>
    startTransition(async () => {
      const estimate = await estimateLiveSimulationAction(
        confirmed,
        session.analytics?.totalIncrementalCostUsd ?? 0,
      );
      setLiveEstimate(estimate);
    });
  const runLive = () =>
    startTransition(async () => {
      const result = await runLiveSimulationAnalyticsAction({
        confirmed: liveConfirmed,
        currentSessionCostUsd: session.analytics?.totalIncrementalCostUsd ?? 0,
      });
      setLiveEstimate(result.estimate);
      setLiveAnalytics(result.analytics);
      setStatus(result.message);
    });

  return (
    <article className="context-inspector revenue-simulator">
      <header className="accounts-header">
        <div>
          <span className="eyebrow">DEVELOPMENT TOOL · SYNTHETIC DATA · REVENUE TIME MACHINE</span>
          <h1>Revenue Simulator</h1>
          <p>Test whether Coinbase renewal intelligence changes proportionally as evidence evolves.</p>
        </div>
        <span className={`simulation-mode mode-${session.executionMode}`}>
          {session.executionMode === "real-provider-development" ? "REAL PROVIDER · GATED" : pretty(session.executionMode)}
        </span>
      </header>

      <section className="twin-card simulator-controls" aria-label="Simulation controls">
        <label>Scenario<select aria-label="Scenario" value={scenario.scenarioId} onChange={(event) => chooseScenario(event.target.value)}>{coinbaseSimulationScenarios.map((item) => <option key={item.scenarioId} value={item.scenarioId}>{item.name}</option>)}</select></label>
        <label>Account<select aria-label="Account" value="acct-coinbase" disabled><option value="acct-coinbase">Coinbase</option></select></label>
        <label>Execution mode<select aria-label="Execution mode" value={session.executionMode} onChange={(event) => chooseMode(event.target.value as SimulationExecutionMode)}><option value="deterministic">Deterministic baseline</option><option value="replay">Replay artifact</option><option value="real-provider-development">Real development provider · gated</option></select></label>
        <div><small>Simulated clock</small><strong>{new Date(session.currentSimulatedTime).toLocaleString()}</strong></div>
        <button type="button" disabled={pending || !session.queuedEvents.length} onClick={runNext}>Run next step</button>
        <button type="button" disabled={pending} onClick={runAll}>Run all events</button>
        <button type="button" onClick={() => setSession({ ...session, status: "paused" })}>Pause</button>
        <button type="button" onClick={() => { setSession(resetSimulationSession(session)); setTimeView("baseline"); }}>Reset</button>
      </section>

      <section className="reconciliation-metrics inspector-metrics" aria-label="Simulation summary">
        <span><strong>{selectedState.snapshot.healthScore}</strong> renewal health</span>
        <span><strong>{session.simulationSteps.length}</strong> completed steps</span>
        <span><strong>{session.diagnostics.sourceRecordsCreated}</strong> evidence records</span>
        <span><strong>{session.diagnostics.factsChanged}</strong> facts changed</span>
        <span><strong>{session.diagnostics.evaluationsRun}</strong> evaluations</span>
        <span><strong>{session.diagnostics.assertionsPassed}/{session.diagnostics.assertionsPassed + session.diagnostics.assertionsFailed}</strong> assertions passed</span>
      </section>

      <section className="twin-card simulator-analytics-summary" aria-label="Cost latency and quality summary">
        <header><div><span className="eyebrow">LLM ECONOMICS · QUALITY TOGETHER</span><h2>Cost, latency & quality</h2></div><small>Pricing catalog {liveEstimate?.cost.pricingVersion ?? "not applied"}</small></header>
        <div className="analytics-metric-grid">
          <article><small>Incremental API cost</small><strong>${(session.analytics?.totalIncrementalCostUsd ?? 0).toFixed(6)}</strong><span>{session.executionMode === "replay" ? "Replay costs $0 now" : pretty(session.executionMode)}</span></article>
          <article><small>Historical replay cost</small><strong>${(session.analytics?.totalHistoricalReplayCostUsd ?? 0).toFixed(6)}</strong><span>Original call · configured estimate</span></article>
          <article><small>Quality</small><strong>{session.analytics?.averageQualityScore ?? 0}</strong><span>Grounding {session.analytics?.averageGroundingScore ?? 0}</span></article>
          <article><small>Eligibility</small><strong>{session.analytics?.eligibilityRate ?? 0}%</strong><span>{session.analytics?.stepCount ?? 0} analyzed steps</span></article>
          <article><small>Latency</small><strong>{session.analytics?.averageLatencyMs ?? 0}ms</strong><span>σ {session.analytics?.latencyStandardDeviation ?? 0}ms</span></article>
          <article><small>Tokens</small><strong>{session.analytics?.totalTokens ?? 0}</strong><span>{session.analytics?.estimatedUsageCount ?? 0} estimated run(s)</span></article>
        </div>
      </section>

      <section className="twin-card simulator-live-cost">
        <div><span className="eyebrow">READINESS-GATED LIVE DEVELOPMENT CALL</span><h2>Pre-run estimate and budget gate</h2><p>Actual provider usage replaces this estimate after a successful call. Configured pricing is not an invoice.</p></div>
        <div className="live-estimate-grid"><span><small>Estimated tokens</small><strong>{liveEstimate?.usage.totalTokens ?? "—"}</strong></span><span><small>Estimated cost</small><strong>{liveEstimate ? `$${liveEstimate.cost.incrementalCostUsd.toFixed(6)}` : "—"}</strong></span><span><small>Projected session</small><strong>{liveEstimate ? `$${liveEstimate.budget.projectedSessionCostUsd.toFixed(6)}` : "—"}</strong></span><span><small>Budget</small><strong>{liveEstimate?.budget.allowed ? "Allowed" : "Blocked"}</strong></span></div>
        <label className="provider-confirm"><input type="checkbox" checked={liveConfirmed} onChange={(event) => { setLiveConfirmed(event.target.checked); refreshLiveEstimate(event.target.checked); }} /> I explicitly approve one readiness-gated, billable development call.</label>
        <button className="primary-button" type="button" disabled={!liveConfirmed || pending || liveEstimate?.budget.allowed === false} onClick={runLive}>Run approved live Coinbase scenario</button>
        {liveEstimate?.budget.blockingReasons.length ? <ul className="budget-blockers">{liveEstimate.budget.blockingReasons.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        {liveAnalytics ? <pre aria-label="Live run analytics">{JSON.stringify(liveAnalytics, null, 2)}</pre> : null}
        {liveComparison ? <div className="live-comparison"><strong>{pretty(liveComparison.verdict)}</strong><p>{liveComparison.explanation}</p><small>Quality {liveComparison.qualityDelta >= 0 ? "+" : ""}{liveComparison.qualityDelta} · Grounding {liveComparison.groundingDelta >= 0 ? "+" : ""}{liveComparison.groundingDelta} · Latency {liveComparison.latencyDeltaMs >= 0 ? "+" : ""}{liveComparison.latencyDeltaMs}ms</small></div> : null}
      </section>

      <div className="simulator-layout">
        <aside className="twin-card simulator-sidebar">
          <h2>Inject revenue event</h2>
          <label>Event type<select aria-label="Event type" value={eventType} onChange={(event) => setEventType(event.target.value as SimulationEventType)}>{simulationEventTypes.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label>
          <label>Severity<select aria-label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>{["informational", "low", "medium", "high", "critical"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>{eventType.includes("usage") ? "Percent change" : eventType.includes("date") ? "New date" : eventType.includes("value") ? "Amount" : "Event-specific value"}<input aria-label="Event-specific value" value={eventValue} onChange={(event) => setEventValue(event.target.value)} /></label>
          <label>Description / reviewer hypothesis<textarea aria-label="Event description" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <button className="primary-button" type="button" onClick={queueEvent}>Add to queue</button>
          <h3>Event queue</h3>
          <ol>{session.queuedEvents.map((item) => <li key={item.eventId}><strong>{pretty(item.eventType)}</strong><small>{new Date(item.effectiveAt).toLocaleDateString()} · {item.severity}</small></li>)}</ol>
        </aside>

        <main className="simulator-results">
          <section className="twin-card time-machine">
            <header><div><span className="eyebrow">TIME MACHINE</span><h2>{timeView === "baseline" ? "Baseline" : `Step ${timeView}`}</h2></div><div className="time-machine-controls"><button type="button" disabled={timeView === "baseline"} onClick={() => setTimeView(timeView === 1 ? "baseline" : typeof timeView === "number" ? timeView - 1 : "baseline")}>Previous</button><select aria-label="Time Machine step" value={timeView} onChange={(event) => setTimeView(event.target.value === "baseline" ? "baseline" : Number(event.target.value))}><option value="baseline">Baseline</option>{session.simulationSteps.map((item) => <option key={item.stepId} value={item.sequence}>Step {item.sequence} · {pretty(session.appliedEvents[item.sequence - 1]?.eventType ?? "event")}</option>)}</select><button type="button" disabled={timeView === session.simulationSteps.length || !session.simulationSteps.length} onClick={() => setTimeView(timeView === "baseline" ? 1 : timeView + 1)}>Next</button></div></header>
          </section>

          {latestStep ? <BeforeAfter step={latestStep} /> : <section className="twin-card simulator-empty"><h2>Known Coinbase baseline loaded</h2><p>Run a scenario or inject an event to compare health, evidence, MEDDPICC, indicators, and governed recommendations.</p></section>}

          <div className="inspector-grid">
            <section className="twin-card"><h2>Historical renewal workspace</h2><pre>{JSON.stringify({executiveSummary:selectedState.renewalWorkspaceViewModel.executiveSummary,narrative:selectedState.renewalWorkspaceViewModel.narrative},null,2)}</pre></section>
            <section className="twin-card"><h2>Historical governed decisions</h2><pre>{JSON.stringify(selectedState.governedDecisions,null,2)}</pre></section>
            <section className="twin-card"><h2>Evidence lineage added</h2><pre>{JSON.stringify(latestStep?.comparison.evidenceChanges ?? [],null,2)}</pre></section>
            <section className="twin-card"><h2>Conflicts and caveats</h2><pre>{JSON.stringify({conflicts:latestStep?.comparison.conflictChanges ?? [],limitations:selectedState.agentContextPackage.contextLimits},null,2)}</pre></section>
            <section className="twin-card"><h2>Evaluation result</h2><pre>{JSON.stringify(latestStep?.evaluationResult ?? "Run a step to evaluate.",null,2)}</pre></section>
            <section className="twin-card"><h2>Decision Control result</h2><pre>{JSON.stringify(latestStep?.governedDecisionResult ?? "Run a step to govern.",null,2)}</pre></section>
            <section className="twin-card twin-wide"><h2>Step cost-quality analysis</h2><pre>{JSON.stringify(latestStep?.analytics ?? "Run a step to calculate analytics.",null,2)}</pre></section>
            <section className="twin-card twin-wide"><h2>Expected-behavior assertions</h2><div className="assertion-list">{latestStep?.expectedBehaviorResult.map((item) => <article className={item.passed ? "assertion-pass" : "assertion-fail"} key={item.assertionId}><strong>{item.passed ? "PASS" : "REVIEW"} · {pretty(item.category)}</strong><p>{item.explanation}</p></article>) ?? <p>No assertions have run.</p>}</div></section>
          </div>
        </main>
      </div>

      <section className="twin-card simulator-review">
        <div><span className="eyebrow">HUMAN APPROPRIATENESS REVIEW</span><h2>Senior AE scorecard</h2><p>Would an experienced AE take this action, and did AROS react proportionally?</p></div>
        <label>Overall review score<select aria-label="Review score" value={reviewScore} onChange={(event) => setReviewScore(Number(event.target.value))}>{[1,2,3,4,5].map((item) => <option key={item} value={item}>{item} / 5</option>)}</select></label>
        <label>Comments<textarea aria-label="Review comments" value={reviewComments} onChange={(event) => setReviewComments(event.target.value)} /></label>
        <button type="button" onClick={saveReview}>Save review</button>
        <pre>{JSON.stringify(scorecard,null,2)}</pre>
      </section>

      <section className="twin-card simulator-persistence">
        <h2>Save, load, import, export, replay</h2>
        <div className="artifact-actions"><button type="button" onClick={() => startTransition(async () => setStatus((await saveSimulationSessionAction(session)).message))}>Save session</button><button type="button" onClick={() => startTransition(async () => { const result = await loadSimulationSessionAction(session.sessionId); setStatus(result.message); if (result.success && "session" in result && result.session) setSession(attachSimulationAnalytics(result.session)); })}>Load session</button><button type="button" onClick={() => setImportValue(exportScenario(scenario))}>Export scenario JSON</button><button type="button" onClick={() => { const imported = importScenario(importValue); setSession(attachSimulationAnalytics(createSimulationSession({ scenario: imported }))); setStatus(`Imported ${imported.name}.`); }}>Import scenario JSON</button></div>
        <textarea aria-label="Scenario import and export" value={importValue} onChange={(event) => setImportValue(event.target.value)} placeholder="Exported scenario JSON appears here." />
      </section>
      <p className="renewal-feedback" aria-live="polite">{pending ? "Running controlled simulation…" : status}</p>
    </article>
  );
}

function BeforeAfter({ step }: { step: SimulationSession["simulationSteps"][number] }) {
  const comparison = step.comparison;
  return <section className="twin-card before-after"><header><div><span className="eyebrow">BEFORE / AFTER</span><h2>{comparison.summary}</h2></div><strong>{comparison.healthChanges.previousScore} → {comparison.healthChanges.currentScore}</strong></header><div className="comparison-grid"><article><h3>Leading indicators</h3>{comparison.leadingIndicatorChanges.length ? comparison.leadingIndicatorChanges.map((item) => <p key={item.indicatorId}><strong>{item.label}</strong><span>{item.previousValue} → {item.currentValue}</span></p>) : <p>No indicator changes.</p>}</article><article><h3>MEDDPICC</h3>{comparison.meddpiccChanges.length ? comparison.meddpiccChanges.map((item) => <p key={item.key}><strong>{pretty(item.key)}</strong><span>{item.previousStatus} → {item.currentStatus}</span></p>) : <p>No MEDDPICC changes.</p>}</article><article><h3>Recommendations</h3>{comparison.recommendationChanges.map((item, index) => <p key={item.currentDecisionId ?? item.previousDecisionId ?? index}><strong>{pretty(item.changeType)}</strong><span>{item.currentRecommendation ?? "Removed"}</span></p>)}</article><article><h3>Evidence and conflicts</h3><p><strong>{comparison.evidenceChanges.length}</strong><span>new evidence items</span></p><p><strong>{comparison.conflictChanges.length}</strong><span>new conflicts</span></p></article></div></section>;
}
