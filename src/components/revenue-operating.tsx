import type { ReactNode } from "react";
import type { RevenueOperatingItem, RevenueOperatingStage } from "@/domain/revenue-operating-model";

const stageLabels: Record<RevenueOperatingStage, string> = {
  SIGNAL: "Signal",
  INSIGHT: "Insight",
  DECISION: "Decision",
  ACTION: "Action",
  OWNERSHIP: "Ownership",
  OUTCOME: "Outcome",
  INSTITUTIONAL_MEMORY: "Institutional memory",
};

export function RevenueImpactBadge({ value }: { value?: number }) {
  if (value == null) return null;
  return (
    <span className="revenue-impact-badge">
      ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)} impact
    </span>
  );
}

export function RiskIndicator({ level, children }: { level: "low" | "medium" | "high" | "critical"; children: ReactNode }) {
  return <span className={`risk-indicator risk-${level}`}>{children}</span>;
}

export function EvidencePanel({ evidence = [], freshness }: { evidence?: string[]; freshness?: string }) {
  return (
    <aside className="evidence-panel" aria-label="Evidence supporting this item">
      <strong>Evidence</strong>
      {freshness && <small>Updated {freshness}</small>}
      {evidence.length ? <ul>{evidence.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p>No evidence attached yet.</p>}
    </aside>
  );
}

export function ActionPanel({ actions }: { actions: Array<{ label: string; href?: string; onClick?: () => void; primary?: boolean }> }) {
  return <div className="action-panel">{actions.map((action) => action.href ? <a className={action.primary ? "primary-button" : "secondary-button"} href={action.href} key={action.label}>{action.label}</a> : <button className={action.primary ? "primary-button" : "secondary-button"} key={action.label} onClick={action.onClick} type="button">{action.label}</button>)}</div>;
}

export function PriorityCard({ item, children }: { item: RevenueOperatingItem; children?: ReactNode }) {
  return (
    <article className="priority-card">
      <div className="priority-card-header">
        <span className="operating-stage">{stageLabels[item.stage]}</span>
        <RevenueImpactBadge value={item.revenueImpact} />
        {item.status && <span className="priority-status">{item.status}</span>}
      </div>
      <h3>{item.title}</h3>
      {(item.accountName || item.opportunityName) && <p className="priority-context">{[item.accountName, item.opportunityName].filter(Boolean).join(" · ")}</p>}
      <p>{item.summary}</p>
      {item.ownerName && <p className="priority-owner">Owner · {item.ownerName}{item.dueAt ? ` · Due ${item.dueAt}` : ""}</p>}
      {children}
    </article>
  );
}

export function CadenceAgenda({ title, purpose, sections }: { title: string; purpose: string; sections: Array<{ heading: string; children: ReactNode }> }) {
  return <section className="cadence-agenda" aria-label={title}><header><div><span className="eyebrow">REVENUE CADENCE</span><h2>{title}</h2><p>{purpose}</p></div></header>{sections.map((section) => <article key={section.heading}><h3>{section.heading}</h3>{section.children}</article>)}</section>;
}

export function RoleContextHeader({ role, organization, scope, signedInAs, viewingAs }: { role: string; organization: string; scope: string; signedInAs: string; viewingAs?: string }) {
  return <div className="role-context-header"><div><span className="eyebrow">{role.toUpperCase()} OPERATING EXPERIENCE</span><strong>{organization}</strong><small>{scope}</small></div><div className="role-context-identity"><span><small>Signed in as</small>{signedInAs}</span>{viewingAs && <span><small>Viewing as</small>{viewingAs}</span>}</div></div>;
}
