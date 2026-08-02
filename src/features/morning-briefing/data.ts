import { createSyntheticMorningBriefing } from "@/data/synthetic/morning-briefing";
import type { AgentStatus, MorningMetric } from "./types";

export const decisionControlResult = createSyntheticMorningBriefing();
export const governedDecisions = decisionControlResult.acceptedDecisions;
export const morningMetrics: MorningMetric[] = [
  { id:"signals",label:"Signals Processed",value:"4,382",indicator:"+18%",tone:"blue" },
  { id:"accounts",label:"Accounts Reviewed",value:"214",indicator:"100% coverage",tone:"blue" },
  { id:"risks",label:"High Priority Risks",value:String(governedDecisions.filter((item)=>item.type.includes("risk") && ["critical","high"].includes(item.priority)).length),indicator:"Governed",tone:"red" },
  { id:"expansion",label:"Expansion Opportunities",value:String(governedDecisions.filter((item)=>item.type === "expansion-opportunity").length),indicator:"Verified",tone:"green" },
  { id:"meetings",label:"Meetings Prepared",value:String(governedDecisions.filter((item)=>item.type === "meeting-preparation").length),indicator:"Ready",tone:"blue" },
];
export const agentStatuses: AgentStatus[] = [
  { id:"renewal",name:"Renewal Agent",status:"Processing",detail:"214 accounts" },
  { id:"expansion",name:"Expansion Agent",status:"Complete",detail:"Governed opportunities" },
  { id:"forecast",name:"Forecast Agent",status:"Complete",detail:"Policy validated" },
  { id:"executive",name:"Executive Agent",status:"Ready",detail:"Morning briefing" },
];
