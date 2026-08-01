"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import { agentStatuses, initialDecisions, initialInsights, morningMetrics } from "./data";
import { briefingReducer } from "./state";
import type { Decision, ItemStatus, Priority, RevenueInsight, Tone } from "./types";

const STORAGE_KEY = "cognivit-aros-morning-briefing";
const navItems = ["AI Command Center", "AI Workforce", "Accounts", "Decisions", "Signals", "Forecast", "Executive", "Settings"];

function Glyph({ children }: { children: React.ReactNode }) {
  return <span className="glyph" aria-hidden="true">{children}</span>;
}

function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Main navigation">
        <div className="brand"><strong>CogniVit<span>.ai</span></strong><small>AROS · AUTONOMOUS REVENUE OS</small></div>
        <nav>
          {navItems.map((item, index) => (
            <button key={item} className={`nav-item ${index === 0 ? "active" : ""}`} aria-current={index === 0 ? "page" : undefined} onClick={index === 0 ? onClose : undefined}>
              <Glyph>{["⌁", "✣", "▣", "◇", "⌁", "↗", "◎", "⚙"][index]}</Glyph>{item}
            </button>
          ))}
        </nav>
        <div className="system-status"><span><i /> LIVE SYSTEM</span><small>214 accounts monitored</small></div>
      </aside>
    </>
  );
}

function PageHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="page-header">
      <button className="menu-button" onClick={onMenu} aria-label="Open navigation"><span /><span /><span /></button>
      <div><h1>Good Morning, Uphaar</h1><p>Your AI workforce analyzed the revenue organization overnight.</p></div>
      <div className="avatar" aria-label="Uphaar Kotru profile">UK</div>
    </header>
  );
}

function StatusPill({ children, tone = "blue" }: { children: React.ReactNode; tone?: Tone | "slate" }) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}

function MetricCard({ label, value, indicator, tone }: { label: string; value: string; indicator: string; tone: Tone }) {
  return <article className="metric-card" tabIndex={0}><p>{label}</p><strong>{value}</strong><StatusPill tone={tone}>{indicator}</StatusPill></article>;
}

function ActionButton({ action, onClick }: { action: "Approve" | "Edit recommendation" | "Dismiss" | "Snooze"; onClick: () => void }) {
  const short = action === "Edit recommendation" ? "Edit" : action;
  return <button className={`action-button action-${short.toLowerCase()}`} onClick={onClick} aria-label={action}>{short}</button>;
}

function ActionRow({ onStatus, onEdit }: { onStatus: (status: ItemStatus) => void; onEdit: () => void }) {
  return <div className="action-row"><ActionButton action="Approve" onClick={() => onStatus("Approved")} /><ActionButton action="Edit recommendation" onClick={onEdit} /><ActionButton action="Snooze" onClick={() => onStatus("Snoozed")} /><ActionButton action="Dismiss" onClick={() => onStatus("Dismissed")} /></div>;
}

function priorityTone(priority: Priority): Tone { return priority === "Critical" || priority === "High" ? "red" : priority === "Opportunity" ? "green" : "blue"; }

function IntelligenceCard({ insight, onSelect }: { insight: RevenueInsight; onSelect: () => void }) {
  return (
    <button className="insight-card" onClick={onSelect} aria-label={`View details for ${insight.title}`}>
      <div className="insight-top"><StatusPill tone={priorityTone(insight.priority)}>{insight.priority.toUpperCase()}</StatusPill>{insight.status !== "Pending" && <StatusPill tone="slate">{insight.status}</StatusPill>}<span className="open-arrow" aria-hidden="true">↗</span></div>
      <h3>{insight.title}</h3><p>{insight.summary}</p>
      <strong className={`impact tone-text-${priorityTone(insight.priority)}`}>{insight.agent} · {insight.businessImpact}</strong>
    </button>
  );
}

function IntelligenceFeed({ insights, state, onSelect, onRetry }: { insights: RevenueInsight[]; state: "ready" | "loading" | "error"; onSelect: (id: string) => void; onRetry: () => void }) {
  return (
    <section className="panel feed-panel" aria-labelledby="feed-title">
      <div className="section-heading"><div><h2 id="feed-title">AI Intelligence Feed</h2><p>Ranked by business impact · Updated 8:02 AM</p></div><span className="analysis-label"><i /> Analysis complete</span></div>
      {state === "loading" && <div className="feed-state" role="status"><span className="spinner" />Analyzing overnight signals…</div>}
      {state === "error" && <div className="feed-state" role="alert"><strong>Intelligence feed unavailable</strong><p>We couldn’t load the latest analysis.</p><button onClick={onRetry}>Try again</button></div>}
      {state === "ready" && insights.length === 0 && <div className="feed-state"><strong>You’re all caught up</strong><p>No new intelligence items require attention.</p></div>}
      {state === "ready" && insights.map((insight) => <IntelligenceCard key={insight.id} insight={insight} onSelect={() => onSelect(insight.id)} />)}
    </section>
  );
}

function Dialog({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key === "Tab" && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, textarea, [tabindex]:not([tabindex="-1"])')).filter((node) => !node.hasAttribute("disabled"));
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; previous?.focus(); };
  }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={dialogRef} className={`dialog ${wide ? "dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="dialog-header"><div><span className="eyebrow">AI RECOMMENDATION</span><h2 id={titleId}>{title}</h2></div><button className="close-button" onClick={onClose} aria-label={`Close ${title}`}>×</button></div>{children}</div></div>;
}

function EditableRecommendation({ value, editing, onSave, onCancel }: { value: string; editing: boolean; onSave: (value: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  if (!editing) return <div className="recommendation"><span className="recommendation-icon">✦</span><div><h3>Recommended next action</h3><p>{value}</p></div></div>;
  return <div className="edit-box"><label htmlFor="recommendation-edit">Edit recommendation</label><textarea id="recommendation-edit" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} /><div><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={() => onSave(draft.trim())} disabled={!draft.trim()}>Save recommendation</button></div></div>;
}

function InsightDetailPanel({ insight, onClose, onStatus, onEdit }: { insight: RevenueInsight; onClose: () => void; onStatus: (status: ItemStatus) => void; onEdit: (recommendation: string) => void }) {
  const [editing, setEditing] = useState(false);
  return <Dialog title={insight.title} onClose={onClose}><div className="dialog-meta"><StatusPill tone={priorityTone(insight.priority)}>{insight.priority}</StatusPill><StatusPill tone="slate">{insight.status}</StatusPill></div><dl className="detail-grid"><div><dt>Account name</dt><dd>{insight.account}</dd></div><div><dt>Signal category</dt><dd>{insight.category}</dd></div><div className="full"><dt>What happened</dt><dd>{insight.whatHappened}</dd></div><div className="full"><dt>Why it matters</dt><dd>{insight.whyItMatters}</dd></div><div className="full"><dt>Supporting evidence</dt><dd><ul>{insight.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></dd></div><div><dt>Business impact</dt><dd>{insight.businessImpact}</dd></div><div><dt>Confidence score</dt><dd><span className="confidence"><i style={{ width: `${insight.confidence}%` }} /> </span>{insight.confidence}%</dd></div><div><dt>Responsible AI agent</dt><dd>{insight.agent}</dd></div></dl><EditableRecommendation key={`${editing}-${insight.recommendedAction}`} value={insight.recommendedAction} editing={editing} onCancel={() => setEditing(false)} onSave={(value) => { onEdit(value); setEditing(false); }} />{!editing && <ActionRow onStatus={onStatus} onEdit={() => setEditing(true)} />}</Dialog>;
}

function DecisionQueueCard({ onOpen }: { onOpen: () => void }) {
  return <section className="panel decision-card"><span className="queue-icon">◇</span><h2>Decisions awaiting you</h2><strong className="decision-count">8</strong><p>3 high impact · $25.6M influenced</p><button className="primary-button full-button" onClick={onOpen}>Review decision queue <span aria-hidden="true">→</span></button></section>;
}

function WorkforceCard() {
  return <section className="panel workforce-card"><div className="section-heading"><div><h2>AI Workforce</h2><p>Autonomous agents · Live</p></div><span className="workforce-live"><i /></span></div><div>{agentStatuses.map((agent) => <div className="agent-row" key={agent.id}><span className={`agent-icon agent-${agent.status.toLowerCase()}`}>✦</span><div><strong>{agent.name}</strong><small>{agent.detail}</small></div><StatusPill tone={agent.status === "Processing" ? "amber" : "green"}>{agent.status}</StatusPill></div>)}</div></section>;
}

function DecisionItem({ decision, onStatus, onEdit }: { decision: Decision; onStatus: (status: ItemStatus) => void; onEdit: (recommendation: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(decision.recommendation);
  return <article className="decision-item"><div className="decision-item-head"><div><span>{decision.account}</span><h3>{decision.title}</h3></div><div><StatusPill tone={decision.priority === "High" ? "red" : "blue"}>{decision.priority} impact</StatusPill><StatusPill tone="slate">{decision.status}</StatusPill></div></div><strong className="decision-impact">{decision.businessImpact}</strong>{editing ? <div className="inline-edit"><label htmlFor={`edit-${decision.id}`}>Edit recommendation for {decision.account}</label><textarea id={`edit-${decision.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus /><button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" onClick={() => { onEdit(draft); setEditing(false); }}>Save</button></div> : <p>{decision.recommendation}</p>} {!editing && <ActionRow onStatus={onStatus} onEdit={() => setEditing(true)} />}</article>;
}

function DecisionQueuePanel({ decisions, onClose, onStatus, onEdit }: { decisions: Decision[]; onClose: () => void; onStatus: (id: string, status: ItemStatus) => void; onEdit: (id: string, value: string) => void }) {
  return <Dialog title="Decision queue" onClose={onClose} wide><div className="queue-summary"><strong>8 decisions</strong><span>3 high impact</span><span>$25.6M influenced</span></div><div className="decision-list">{decisions.map((decision) => <DecisionItem key={decision.id} decision={decision} onStatus={(status) => onStatus(decision.id, status)} onEdit={(value) => onEdit(decision.id, value)} />)}</div></Dialog>;
}

export function MorningBriefingDashboard() {
  const [state, dispatch] = useReducer(briefingReducer, { insights: initialInsights, decisions: initialDecisions });
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedState, setFeedState] = useState<"ready" | "loading" | "error">("ready");
  const hydrated = useRef(false);

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { const parsed = JSON.parse(saved) as typeof state; parsed.insights.forEach((item) => { if (item.status !== "Pending") dispatch({ type: "set-insight-status", id: item.id, status: item.status }); dispatch({ type: "edit-insight", id: item.id, recommendation: item.recommendedAction }); }); parsed.decisions.forEach((item) => { if (item.status !== "Pending") dispatch({ type: "set-decision-status", id: item.id, status: item.status }); dispatch({ type: "edit-decision", id: item.id, recommendation: item.recommendation }); }); } } catch { localStorage.removeItem(STORAGE_KEY); } finally { hydrated.current = true; }
  }, []);
  useEffect(() => { if (hydrated.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { if (!feedback) return; const timeout = window.setTimeout(() => setFeedback(""), 3500); return () => window.clearTimeout(timeout); }, [feedback]);

  const selectedInsight = state.insights.find((item) => item.id === selectedInsightId);
  const updateInsightStatus = (status: ItemStatus) => { if (!selectedInsightId) return; dispatch({ type: "set-insight-status", id: selectedInsightId, status }); setFeedback(`${selectedInsight?.account} insight ${status.toLowerCase()}.`); };
  const updateDecisionStatus = (id: string, status: ItemStatus) => { dispatch({ type: "set-decision-status", id, status }); const decision = state.decisions.find((item) => item.id === id); setFeedback(`${decision?.account} decision ${status.toLowerCase()}.`); };

  return <div className="app-shell"><AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><main className="main-content"><PageHeader onMenu={() => setSidebarOpen(true)} /><section className="metrics-grid" aria-label="Morning metrics">{morningMetrics.map((metric) => <MetricCard key={metric.id} {...metric} />)}</section><div className="dashboard-grid"><IntelligenceFeed insights={state.insights} state={feedState} onSelect={setSelectedInsightId} onRetry={() => { setFeedState("loading"); window.setTimeout(() => setFeedState("ready"), 450); }} /><aside className="right-rail"><DecisionQueueCard onOpen={() => setQueueOpen(true)} /><WorkforceCard /></aside></div><div className="prototype-controls" aria-label="Demo feed states"><button onClick={() => setFeedState("loading")}>Loading state</button><button onClick={() => setFeedState("error")}>Error state</button><button onClick={() => setFeedState("ready")}>Reset feed</button></div></main>{selectedInsight && <InsightDetailPanel insight={selectedInsight} onClose={() => setSelectedInsightId(null)} onStatus={updateInsightStatus} onEdit={(recommendation) => { dispatch({ type: "edit-insight", id: selectedInsight.id, recommendation }); setFeedback("Recommendation updated."); }} />}{queueOpen && <DecisionQueuePanel decisions={state.decisions} onClose={() => setQueueOpen(false)} onStatus={updateDecisionStatus} onEdit={(id, recommendation) => { dispatch({ type: "edit-decision", id, recommendation }); setFeedback("Decision recommendation updated."); }} />}<div className="toast" aria-live="polite" aria-atomic="true">{feedback}</div></div>;
}
