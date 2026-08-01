import type { AgentStatus, Decision, MorningMetric, RevenueInsight } from "./types";

export const morningMetrics: MorningMetric[] = [
  { id: "signals", label: "Signals Processed", value: "4,382", indicator: "+18%", tone: "blue" },
  { id: "accounts", label: "Accounts Reviewed", value: "214", indicator: "100% coverage", tone: "blue" },
  { id: "risks", label: "High Priority Risks", value: "6", indicator: "2 new", tone: "red" },
  { id: "expansion", label: "Expansion Opportunities", value: "12", indicator: "$8.4M potential", tone: "green" },
  { id: "meetings", label: "Meetings Prepared", value: "7", indicator: "Ready", tone: "blue" },
];

export const initialInsights: RevenueInsight[] = [
  {
    id: "coinbase-renewal",
    account: "Coinbase",
    category: "Renewal risk",
    priority: "Critical",
    title: "Coinbase renewal risk increased",
    summary: "Security review stalled; executive sponsor engagement fell 42%.",
    whatHappened: "The security questionnaire has had no movement for 11 days, while engagement from the executive sponsor dropped sharply across email and meetings.",
    whyItMatters: "Security approval is on the renewal critical path and the sponsor has historically unblocked procurement. Both signals now threaten the October renewal window.",
    evidence: ["Security review unchanged since July 21", "Executive sponsor engagement down 42% in 30 days", "Two renewal emails unanswered"],
    businessImpact: "$22.4M ARR at risk",
    confidence: 94,
    recommendedAction: "Ask the CRO to sponsor a 20-minute executive alignment with Coinbase and offer a security architect for the stalled review.",
    agent: "Renewal Agent",
    status: "Pending",
  },
  {
    id: "paypal-expansion",
    account: "PayPal",
    category: "Expansion opportunity",
    priority: "Opportunity",
    title: "PayPal expansion signal detected",
    summary: "New fraud modernization initiative maps to three active use cases.",
    whatHappened: "PayPal announced an internal fraud modernization program and three stakeholders engaged with material tied to active AROS use cases.",
    whyItMatters: "The initiative creates an executive-level reason to consolidate three separate evaluations into a funded expansion motion this quarter.",
    evidence: ["Fraud program mentioned in July 31 earnings call", "Three product-content visits from target stakeholders", "Two open opportunities share the same budget owner"],
    businessImpact: "$3.2M potential",
    confidence: 89,
    recommendedAction: "Send the VP of Risk a tailored value hypothesis and propose a joint discovery session with the three use-case owners.",
    agent: "Expansion Agent",
    status: "Pending",
  },
  {
    id: "nvidia-briefing",
    account: "NVIDIA",
    category: "Executive meeting",
    priority: "Meeting Ready",
    title: "NVIDIA executive briefing prepared",
    summary: "Agenda, stakeholder map, talk track and next-best actions are ready.",
    whatHappened: "The relationship agent synthesized recent calls, opportunity notes, stakeholder history, and open commitments for today’s executive briefing.",
    whyItMatters: "The meeting is the strongest near-term opportunity to secure executive sponsorship for the global rollout and align on success criteria.",
    evidence: ["Seven recent call transcripts analyzed", "Five stakeholders mapped by influence", "Three open commitments included in the agenda"],
    businessImpact: "Meeting at 11:00 AM",
    confidence: 97,
    recommendedAction: "Review the prepared talk track, confirm the rollout success metric, and open with the unresolved data-residency commitment.",
    agent: "Relationship Agent",
    status: "Pending",
    meetingTime: "11:00 AM",
  },
];

export const initialDecisions: Decision[] = [
  { id: "d1", account: "Coinbase", title: "Escalate stalled security review", businessImpact: "$22.4M ARR", priority: "High", recommendation: "Request an executive security alignment this week.", status: "Pending" },
  { id: "d2", account: "PayPal", title: "Launch fraud modernization discovery", businessImpact: "$3.2M potential", priority: "High", recommendation: "Invite three use-case owners to a joint workshop.", status: "Pending" },
  { id: "d3", account: "Snowflake", title: "Protect at-risk platform renewal", businessImpact: "$1.8M ARR", priority: "High", recommendation: "Assign a technical sponsor and recovery plan.", status: "Pending" },
  { id: "d4", account: "Adobe", title: "Multi-thread the buying committee", businessImpact: "$950K pipeline", priority: "Medium", recommendation: "Introduce the regional VP to the economic buyer.", status: "Pending" },
  { id: "d5", account: "ServiceNow", title: "Advance the value validation", businessImpact: "$780K pipeline", priority: "Medium", recommendation: "Share the completed ROI model before Friday.", status: "Pending" },
  { id: "d6", account: "Databricks", title: "Resolve procurement blocker", businessImpact: "$640K ARR", priority: "Medium", recommendation: "Route revised terms to procurement counsel.", status: "Pending" },
  { id: "d7", account: "Stripe", title: "Re-engage dormant champion", businessImpact: "$510K pipeline", priority: "Medium", recommendation: "Send a milestone recap with a new executive insight.", status: "Pending" },
  { id: "d8", account: "Zoom", title: "Confirm expansion timeline", businessImpact: "$420K potential", priority: "Medium", recommendation: "Schedule a planning call with the operations lead.", status: "Pending" },
];

export const agentStatuses: AgentStatus[] = [
  { id: "renewal", name: "Renewal Agent", status: "Processing", detail: "214 accounts" },
  { id: "expansion", name: "Expansion Agent", status: "Complete", detail: "12 opportunities" },
  { id: "forecast", name: "Forecast Agent", status: "Complete", detail: "Q3 variance ±3.2%" },
  { id: "executive", name: "Executive Agent", status: "Ready", detail: "Morning briefing" },
];
