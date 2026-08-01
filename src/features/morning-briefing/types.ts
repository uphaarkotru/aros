export type Tone = "blue" | "red" | "green" | "amber";
export type ItemStatus = "Pending" | "Approved" | "Dismissed" | "Snoozed";
export type Priority = "Critical" | "Opportunity" | "Meeting Ready" | "High" | "Medium";

export interface MorningMetric {
  id: string;
  label: string;
  value: string;
  indicator: string;
  tone: Tone;
}

export interface RevenueInsight {
  id: string;
  account: string;
  category: string;
  priority: Extract<Priority, "Critical" | "Opportunity" | "Meeting Ready">;
  title: string;
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  evidence: string[];
  businessImpact: string;
  confidence: number;
  recommendedAction: string;
  agent: string;
  status: ItemStatus;
  meetingTime?: string;
}

export interface Decision {
  id: string;
  account: string;
  title: string;
  businessImpact: string;
  priority: Extract<Priority, "High" | "Medium">;
  recommendation: string;
  status: ItemStatus;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "Processing" | "Complete" | "Ready";
  detail: string;
}
