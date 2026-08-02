export type Tone = "blue" | "red" | "green" | "amber";
export interface MorningMetric { id: string; label: string; value: string; indicator: string; tone: Tone; }
export interface AgentStatus { id: string; name: string; status: "Processing" | "Complete" | "Ready"; detail: string; }
