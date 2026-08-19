"use client";

import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { defaultDecisionControlPolicy } from "@/decision-control";
import type {
  DecisionPriority,
  DecisionStatus,
  GovernedDecision,
} from "@/domain/decisions/types";
import { decisionControlResult } from "./data";
import {
  activeDecisions,
  decisionQueue,
  intelligenceFeed,
  queueMetrics,
} from "./selectors";
import { humanWorkflowReducer, mergeHumanState } from "./state";
import type { Tone } from "./types";
import { useOptionalSession } from "@/auth/session-context";
import {
  revenueExecutionIndicatorDefinition,
  summarizeRevenueExecutionHealth,
  type RevenueExecutionIndicator,
} from "@/revenue-execution-indicators/domain";
import { aeNavigation } from "@/components/navigation-config";

const navItems = [{ label: "Today", href: "/today" }, ...aeNavigation];
const now = () => new Date().toISOString();
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const label = (value: string) =>
  value
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
const toneForPriority = (priority: DecisionPriority): Tone =>
  priority === "critical" || priority === "high"
    ? "red"
    : priority === "medium"
      ? "amber"
      : "blue";

function StatusPill({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: Tone | "slate";
}) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}
function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
      <aside
        className={`sidebar ${open ? "sidebar-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="brand">
          <strong>
            CogniVit<span>.ai</span>
          </strong>
          <small>AROS · AUTONOMOUS REVENUE OS</small>
        </div>
        <nav>
          {navItems.map((item, index) => (
            <Link
              key={item.label}
              className={`nav-item ${index === 0 ? "active" : ""}`}
              aria-current={index === 0 ? "page" : undefined}
              href={item.href}
              onClick={index === 0 ? onClose : undefined}
            >
              <span className="glyph" aria-hidden="true">
                {["⌁", "▣", "◇", "◫", "⚙"][index]}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="system-status">
          <span>
            <i /> LIVE SYSTEM
          </span>
          <small>214 accounts monitored</small>
        </div>
      </aside>
    </>
  );
}
function PageHeader({
  onMenu,
  decisions,
}: {
  onMenu: () => void;
  decisions: GovernedDecision[];
}) {
  const session = useOptionalSession(),
    userName = session?.viewUser.displayName ?? "Uphaar Kotru",
    renewal = decisions.find(
      (item) =>
        item.accountId === "acct-coinbase" && item.type === "renewal-risk",
    ),
    parts = userName.split(" "),
    initials = parts
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return (
    <>
      <header className="page-header">
        <button
          className="menu-button"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <h1>Good Morning, {parts[0]}</h1>
          <p>
            Revenue intelligence prepared your latest signals and decisions.
          </p>
        </div>
        <div className="avatar" aria-label={`${userName} profile`}>
          {initials}
        </div>
      </header>
      <Link
        className="briefing-renewal-link"
        href="/accounts/acct-coinbase/renewal"
      >
        <span>✦ Renewal Intelligence</span>
        <strong>
          Coinbase · {money(renewal?.verifiedBusinessImpactValue ?? 0)} ARR at
          risk
        </strong>
        <small>Open the evidence-grounded action plan →</small>
      </Link>
    </>
  );
}

function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && ref.current) {
        const nodes = [
          ...ref.current.querySelectorAll<HTMLElement>(
            'button,textarea,[tabindex]:not([tabindex="-1"])',
          ),
        ].filter((node) => !node.hasAttribute("disabled"));
        if (!nodes.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`dialog ${wide ? "dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <div>
            <span className="eyebrow">GOVERNED DECISION</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ActionRow({
  decision,
  onStatus,
  onEdit,
  onExecute,
}: {
  decision: GovernedDecision;
  onStatus: (status: DecisionStatus) => void;
  onEdit: () => void;
  onExecute: () => void;
}) {
  return (
    <div className="action-row">
      {decision.status === "ready-for-execution" ? (
        <button
          className="action-button action-approve"
          onClick={onExecute}
          aria-label="Simulate execution"
        >
          Simulate execution
        </button>
      ) : (
        <button
          className="action-button action-approve"
          onClick={() => onStatus("approved")}
          aria-label="Approve"
        >
          Approve
        </button>
      )}
      <button
        className="action-button"
        onClick={onEdit}
        aria-label="Edit recommendation"
      >
        Edit
      </button>
      <button
        className="action-button"
        onClick={() => onStatus("snoozed")}
        aria-label="Snooze"
      >
        Snooze
      </button>
      <button
        className="action-button action-dismiss"
        onClick={() => onStatus("dismissed")}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
function EditRecommendation({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="edit-box">
      <label htmlFor="recommendation-edit">Edit recommendation</label>
      <textarea
        id="recommendation-edit"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div>
        <button className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={!draft.trim()}
          onClick={() => onSave(draft.trim())}
        >
          Save recommendation
        </button>
      </div>
    </div>
  );
}
function IntelligenceCard({
  decision,
  onSelect,
}: {
  decision: GovernedDecision;
  onSelect: () => void;
}) {
  return (
    <button
      className="insight-card"
      onClick={onSelect}
      aria-label={`View details for ${decision.title}`}
    >
      <div className="insight-top">
        <StatusPill tone={toneForPriority(decision.priority)}>
          {decision.priority.toUpperCase()}
        </StatusPill>
        {decision.status !== "pending" && (
          <StatusPill tone="slate">{label(decision.status)}</StatusPill>
        )}
        <span className="open-arrow" aria-hidden="true">
          ↗
        </span>
      </div>
      <h3>{decision.title}</h3>
      <p>{decision.summary}</p>
      <strong
        className={`impact tone-text-${toneForPriority(decision.priority)}`}
      >
        {decision.responsibleAgent} · {decision.verifiedBusinessImpact}
      </strong>
    </button>
  );
}
function IntelligenceFeed({
  decisions,
  onSelect,
}: {
  decisions: GovernedDecision[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel feed-panel" aria-labelledby="feed-title">
      <div className="section-heading">
        <div>
          <h2 id="feed-title">AI Intelligence Feed</h2>
          <p>Governed and ranked by business impact · Updated 8:02 AM</p>
        </div>
        <span className="analysis-label">
          <i /> Control checks complete
        </span>
      </div>
      {decisions.length ? (
        decisions.map((decision) => (
          <IntelligenceCard
            key={decision.id}
            decision={decision}
            onSelect={() => onSelect(decision.id)}
          />
        ))
      ) : (
        <div className="feed-state">
          <strong>You’re all caught up</strong>
          <p>No governed decisions require attention.</p>
        </div>
      )}
    </section>
  );
}

function DetailPanel({
  decision,
  onClose,
  onStatus,
  onEdit,
  onExecute,
}: {
  decision: GovernedDecision;
  onClose: () => void;
  onStatus: (status: DecisionStatus) => void;
  onEdit: (value: string) => void;
  onExecute: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const impactChanged = !decision.impactVerification.accepted;
  return (
    <Dialog title={decision.title} onClose={onClose}>
      <div className="dialog-meta">
        <StatusPill tone={toneForPriority(decision.priority)}>
          {decision.priority.toUpperCase()} ·{" "}
          {decision.priorityScore.toFixed(1)}
        </StatusPill>
        <StatusPill tone="slate">{label(decision.status)}</StatusPill>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Account</dt>
          <dd>{decision.accountName}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{decision.category}</dd>
        </div>
        <div className="full">
          <dt>What happened</dt>
          <dd>{decision.whatHappened}</dd>
        </div>
        <div className="full">
          <dt>Why it matters</dt>
          <dd>{decision.whyItMatters}</dd>
        </div>
        <div className="full">
          <dt>Verified evidence</dt>
          <dd>
            <ul>
              {decision.evidence.map((item) => (
                <li key={item.id}>
                  <strong>{item.source}</strong> · {item.title} (
                  {Math.round(item.reliability * 100)}%)
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>Verified impact</dt>
          <dd>{decision.verifiedBusinessImpact}</dd>
        </div>
        <div>
          <dt>Proposed impact</dt>
          <dd>
            {decision.proposedBusinessImpact}
            {impactChanged && <StatusPill tone="amber"> Adjusted</StatusPill>}
          </dd>
        </div>
        <div className="full">
          <dt>Confidence assessment</dt>
          <dd>
            <span className="confidence">
              <i style={{ width: `${decision.confidence * 100}%` }} />
            </span>
            {Math.round(decision.confidence * 100)}% · Evidence{" "}
            {Math.round(decision.confidenceAssessment.evidenceConfidence * 100)}
            % · Corroboration{" "}
            {Math.round(decision.confidenceAssessment.corroborationScore * 100)}
            %
          </dd>
        </div>
        <div className="full">
          <dt>Priority scoring breakdown</dt>
          <dd className="score-list">
            {Object.entries(decision.scoringBreakdown).map(([key, value]) => (
              <span key={key}>
                {label(key)}: {value.toFixed(1)}
              </span>
            ))}
          </dd>
        </div>
        <div className="full">
          <dt>Approval policy</dt>
          <dd>
            {decision.approvalPolicy.reason} Role:{" "}
            {decision.approvalPolicy.requiredRole}; approvers:{" "}
            {decision.approvalPolicy.minimumApprovers}.
          </dd>
        </div>
        <div>
          <dt>Responsible AI agent</dt>
          <dd>{decision.responsibleAgent}</dd>
        </div>
        <div>
          <dt>Execution mode</dt>
          <dd>{label(decision.executionPolicy.mode)} (simulation only)</dd>
        </div>
        {decision.governanceFlags.length > 0 && (
          <div className="full">
            <dt>Governance warnings</dt>
            <dd className="flag-list">
              {decision.governanceFlags.map((flag) => (
                <StatusPill key={flag} tone="amber">
                  {label(flag)}
                </StatusPill>
              ))}
            </dd>
          </div>
        )}
      </dl>
      {editing ? (
        <EditRecommendation
          value={decision.recommendedAction}
          onCancel={() => setEditing(false)}
          onSave={(value) => {
            onEdit(value);
            setEditing(false);
          }}
        />
      ) : (
        <div className="recommendation">
          <span className="recommendation-icon">✦</span>
          <div>
            <h3>Recommended next action</h3>
            <p>{decision.recommendedAction}</p>
          </div>
        </div>
      )}{" "}
      {!editing && decision.status !== "executed" && (
        <ActionRow
          decision={decision}
          onStatus={onStatus}
          onEdit={() => setEditing(true)}
          onExecute={onExecute}
        />
      )}
    </Dialog>
  );
}
function QueueCard({
  metrics,
  onOpen,
}: {
  metrics: ReturnType<typeof queueMetrics>;
  onOpen: () => void;
}) {
  return (
    <section className="panel decision-card">
      <span className="queue-icon">◇</span>
      <h2>Decisions awaiting you</h2>
      <strong className="decision-count">{metrics.count}</strong>
      <p>
        {metrics.highImpactCount} high impact ·{" "}
        {money(metrics.influencedRevenue)} influenced
      </p>
      <button className="primary-button full-button" onClick={onOpen}>
        Review decision queue <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
function DecisionItem({
  decision,
  onOpen,
}: {
  decision: GovernedDecision;
  onOpen: () => void;
}) {
  return (
    <article className="decision-item">
      <div className="decision-item-head">
        <div>
          <span>{decision.accountName}</span>
          <h3>{decision.title}</h3>
        </div>
        <div>
          <StatusPill tone={toneForPriority(decision.priority)}>
            {decision.priority} impact
          </StatusPill>
          <StatusPill tone="slate">{label(decision.status)}</StatusPill>
        </div>
      </div>
      <strong className="decision-impact">
        {decision.verifiedBusinessImpact}
      </strong>
      <p>{decision.recommendedAction}</p>
      <button
        className="secondary-button"
        onClick={onOpen}
        aria-label={`Review ${decision.title}`}
      >
        Review decision
      </button>
    </article>
  );
}
function QueuePanel({
  decisions,
  metrics,
  onClose,
  onSelect,
}: {
  decisions: GovernedDecision[];
  metrics: ReturnType<typeof queueMetrics>;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Dialog title="Decision queue" onClose={onClose} wide>
      <div className="queue-summary">
        <strong>{metrics.count} decisions</strong>
        <span>{metrics.highImpactCount} high impact</span>
        <span>{money(metrics.influencedRevenue)} influenced</span>
      </div>
      <div className="decision-list">
        {decisions.map((decision) => (
          <DecisionItem
            key={decision.id}
            decision={decision}
            onOpen={() => onSelect(decision.id)}
          />
        ))}
      </div>
    </Dialog>
  );
}
function Diagnostics() {
  const d = decisionControlResult.diagnostics;
  return (
    <details className="diagnostics">
      <summary>Decision control diagnostics</summary>
      <dl>
        {Object.entries(d).map(([key, value]) => (
          <div key={key}>
            <dt>{label(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3>Rejected candidates</h3>
      {decisionControlResult.rejectedCandidates.map((item) => (
        <p key={item.candidateId}>
          {item.candidateId}:{" "}
          {item.issues.map((issue) => issue.code).join(", ")}
        </p>
      ))}
    </details>
  );
}

export interface AssignedAccountSummary {
  id: string;
  name: string;
  segment: string | null;
  status: string;
  healthScore?: number | null;
  healthStatus?: RevenueExecutionIndicator["status"];
}
export interface CadenceSummary {
  id: string;
  status: string;
  scope: string;
  scheduledAt: string | null;
  templateCode: string;
  templateName: string;
  opportunityName: string | null;
  accountName: string | null;
  participantNames: string | null;
  preparationSummary: string;
  agendaCount: number;
  carryForwardCount: number;
}

const cadenceTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Scheduling needed";

function UpcomingCadences({ cadences }: { cadences: CadenceSummary[] }) {
  const upcoming = cadences
    .filter((cadence) => cadence.status !== "COMPLETED")
    .slice(0, 4);
  return (
    <section className="ae-cadences panel" aria-labelledby="ae-cadences-title">
      <div className="section-heading">
        <div>
          <h2 id="ae-cadences-title">My upcoming cadences</h2>
          <p>
            Manager 1:1s and cross-functional meetings prepared from signals and
            prior action items.
          </p>
        </div>
        <Link href="/cadences">Open unified cadence →</Link>
      </div>
      {upcoming.length ? (
        <div className="ae-cadence-list">
          {upcoming.map((cadence) => (
            <Link href={`/cadences/${cadence.id}`} key={cadence.id}>
              <div className="ae-cadence-time">
                <span>{cadence.status}</span>
                <strong>{cadenceTime(cadence.scheduledAt)}</strong>
              </div>
              <div>
                <small>{cadence.templateCode.replaceAll("_", " ")}</small>
                <h3>{cadence.templateName}</h3>
                <p>
                  {cadence.opportunityName ??
                    cadence.accountName ??
                    cadence.scope}
                </p>
                <span>{cadence.participantNames}</span>
              </div>
              <div className="ae-cadence-prep">
                <strong>AI preparation</strong>
                <p>{cadence.preparationSummary}</p>
                <small>
                  {cadence.agendaCount} agenda items ·{" "}
                  {cadence.carryForwardCount} previous actions
                </small>
              </div>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>
      ) : (
        <div className="feed-state">
          <strong>No upcoming cadences</strong>
          <p>No prepared or scheduled sessions are assigned to you.</p>
        </div>
      )}
    </section>
  );
}

export function RevenueExecutionHealthStrip({
  indicators,
  title = "My revenue execution health",
  scopeLabel = "your territory",
  accountId,
  instanceId,
}: {
  indicators: RevenueExecutionIndicator[];
  title?: string;
  scopeLabel?: string;
  accountId?: string;
  instanceId?: string;
}) {
  if (!indicators.length) return null;
  const primary = indicators.find(
    (item) => item.status === "AT_RISK" || item.status === "CRITICAL",
  );
  const titleId = `revenue-execution-title-${accountId ?? instanceId ?? "territory"}`;
  const overallHealth = summarizeRevenueExecutionHealth(indicators);
  const overallLabel = accountId
    ? "Overall account health"
    : "Overall territory health";
  return (
    <section
      className="revenue-execution-panel panel"
      aria-labelledby={titleId}
    >
      <div className="section-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>
            Five leading indicators consolidated across {scopeLabel}. Open any
            indicator for evidence, benchmarks, and focused actions.
          </p>
        </div>
        <div className="revenue-execution-heading-meta">
          <div className="revenue-execution-overall">
            <span>{overallLabel}</span>
            <strong
              className={`revenue-execution-overall-score health-${overallHealth.status.toLowerCase()}`}
            >
              {overallHealth.score ?? "—"}
            </strong>
          </div>
          <span className="analysis-label">
            <i /> Explainable evidence
          </span>
        </div>
      </div>
      <div className="revenue-execution-strip">
        {indicators.map((indicator) => {
          const definition = revenueExecutionIndicatorDefinition(
            indicator.indicatorType,
          );
          return (
            <Link
              aria-label={`Open ${definition.label} details`}
              className={`revenue-execution-card canonical-${indicator.status.toLowerCase()}`}
              href={`/today/revenue-execution/${indicator.indicatorType}${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`}
              key={indicator.indicatorType}
              title={indicator.rationale}
            >
              <span>{definition.label}</span>
              <strong>{indicator.score ?? "—"}</strong>
              <small className={`execution-${indicator.status.toLowerCase()}`}>
                {indicator.status.replaceAll("_", " ")}{" "}
                {indicator.trend === "DETERIORATING"
                  ? "↓"
                  : indicator.trend === "IMPROVING"
                    ? "↑"
                    : "→"}
              </small>
              <p>{indicator.evidence[0]?.text ?? indicator.implication}</p>
              <b>View details →</b>
            </Link>
          );
        })}
      </div>
      <div className="primary-coaching-insight">
        <strong>AROS primary coaching insight</strong>
        <p>
          {primary?.recommendedNextAction ??
            "Execution conditions are healthy; keep the next customer-confirmed milestone visible."}
        </p>
      </div>
    </section>
  );
}

export function MorningBriefingDashboard({
  initialDecisions,
  assignedAccounts = [],
  cadences = [],
  executionIndicators = [],
  executionIndicatorsTitle = "My revenue execution health",
  embedded = false,
}: {
  initialDecisions: GovernedDecision[];
  assignedAccounts?: AssignedAccountSummary[];
  cadences?: CadenceSummary[];
  executionIndicators?: RevenueExecutionIndicator[];
  executionIndicatorsTitle?: string;
  embedded?: boolean;
}) {
  const [humanState, dispatch] = useReducer(humanWorkflowReducer, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);
  const decisions = useMemo(
    () =>
      initialDecisions.map((decision) =>
        mergeHumanState(decision, humanState[decision.id]),
      ),
    [humanState, initialDecisions],
  );
  const feed = intelligenceFeed(decisions);
  const queue = decisionQueue(decisions);
  const metrics = queueMetrics(
    decisions,
    defaultDecisionControlPolicy.highImpactThreshold,
  );
  const selected = decisions.find((decision) => decision.id === selectedId);
  const persistDecision = (
    decision: GovernedDecision,
    action: "approve" | "dismiss" | "edit" | "execute" | "snooze",
    recommendation?: string,
  ) =>
    process.env.NODE_ENV === "test"
      ? Promise.resolve()
      : fetch(`/api/decisions/${encodeURIComponent(decision.id)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, recommendation }),
        }).then(() => undefined);
  const update = (decision: GovernedDecision, status: DecisionStatus) => {
    dispatch({ type: "set-status", decision, status, now: now() });
    if (status === "approved" || status === "dismissed" || status === "snoozed")
      void persistDecision(
        decision,
        status === "approved"
          ? "approve"
          : status === "dismissed"
            ? "dismiss"
            : "snooze",
      );
    setFeedback(`${decision.accountName} decision ${status}.`);
  };
  const diagnostics =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("diagnostics") === "1";
  return (
    <div className={`app-shell ${embedded ? "embedded-app-shell" : ""}`}>
      {!embedded && (
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      <main
        className={`main-content ${embedded ? "embedded-main-content" : ""}`}
      >
        <PageHeader onMenu={() => setSidebarOpen(true)} decisions={decisions} />
        <section
          className="assigned-accounts panel"
          aria-labelledby="assigned-accounts-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="assigned-accounts-title">My accounts</h2>
              <p>Accounts in your active revenue-team jurisdiction.</p>
            </div>
            <Link href="/accounts">View all account context</Link>
          </div>
          {assignedAccounts.length > 0 ? (
            <div className="assigned-account-list">
              {assignedAccounts.map((account) => (
                <Link href={`/accounts/${account.id}`} key={account.id}>
                  <strong>{account.name}</strong>
                  <span>{account.segment ?? "Enterprise"}</span>
                  <span
                    className={`assigned-account-health health-${(account.healthStatus ?? "UNKNOWN").toLowerCase()}`}
                    aria-label={`Health score ${account.healthScore ?? "unknown"}`}
                  >
                    {account.healthScore ?? "—"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="assigned-accounts-empty">
              No accounts are currently assigned to your revenue team.
            </p>
          )}
        </section>
        <div className="dashboard-grid">
          <IntelligenceFeed decisions={feed} onSelect={setSelectedId} />
          <aside className="right-rail">
            <QueueCard metrics={metrics} onOpen={() => setQueueOpen(true)} />
          </aside>
        </div>
        <RevenueExecutionHealthStrip
          indicators={executionIndicators}
          title={executionIndicatorsTitle}
        />
        <UpcomingCadences cadences={cadences} />
        {activeDecisions(decisions).length === 0 && (
          <div className="feed-state">
            <strong>No accepted decisions</strong>
            <p>The control layer has no active governed decisions.</p>
          </div>
        )}
        {diagnostics && <Diagnostics />}
      </main>
      {queueOpen && (
        <QueuePanel
          decisions={queue}
          metrics={metrics}
          onClose={() => setQueueOpen(false)}
          onSelect={(id) => {
            setQueueOpen(false);
            setSelectedId(id);
          }}
        />
      )}
      {selected && (
        <DetailPanel
          decision={selected}
          onClose={() => setSelectedId(null)}
          onStatus={(status) => update(selected, status)}
          onEdit={(recommendation) => {
            void persistDecision(selected, "edit", recommendation);
            dispatch({
              type: "edit",
              decision: selected,
              recommendation,
              now: now(),
            });
            setFeedback("Recommendation updated.");
          }}
          onExecute={() => {
            void persistDecision(selected, "execute");
            dispatch({ type: "execute", decision: selected, now: now() });
            setFeedback("Execution simulated and audited.");
          }}
        />
      )}
      <div className="toast" aria-live="polite">
        {feedback}
      </div>
    </div>
  );
}
