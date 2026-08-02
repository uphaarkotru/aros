import type { EvidenceItem, EvidenceSource } from "@/domain/evidence/types";

const makeEvidence = (id:string,accountId:string,source:EvidenceSource,type:string,title:string,summary:string,observedAt:string,reliability:number): EvidenceItem => ({ id,accountId,source,type,title,summary,observedAt,reliability,sourceRecordId:`synthetic-${id}`,metadata:{ synthetic:true } });
export const syntheticEvidence: EvidenceItem[] = [
  makeEvidence("ev-cb-security","acct-coinbase","salesforce","security-review","Security review stalled","Questionnaire unchanged for 11 days.","2026-07-31T15:00:00.000Z",.96),
  makeEvidence("ev-cb-sponsor","acct-coinbase","gong","engagement","Sponsor engagement fell","Executive engagement declined 42%.","2026-07-30T18:00:00.000Z",.91),
  makeEvidence("ev-cb-email","acct-coinbase","email","engagement","Renewal emails unanswered","Two renewal messages have no reply.","2026-07-29T17:00:00.000Z",.78),
  makeEvidence("ev-pp-opportunity","acct-paypal","salesforce","opportunity","Fraud modernization opportunity","Three use cases map to an active opportunity.","2026-07-31T16:00:00.000Z",.97),
  makeEvidence("ev-pp-news","acct-paypal","external-news","initiative","Fraud program announced","Modernization initiative named publicly.","2026-07-30T12:00:00.000Z",.82),
  makeEvidence("ev-nv-calendar","acct-nvidia","calendar","meeting","Executive briefing scheduled","Executive meeting is scheduled for 11 AM.","2026-08-01T08:00:00.000Z",.99),
  makeEvidence("ev-nv-gong","acct-nvidia","gong","meeting-context","Recent calls synthesized","Seven calls contain rollout commitments.","2026-07-31T20:00:00.000Z",.94),
  makeEvidence("ev-ft-gong","acct-franklin","gong","relationship","Champion participation declined","Champion missed two success reviews.","2026-07-28T17:00:00.000Z",.9),
  makeEvidence("ev-ft-email","acct-franklin","email","relationship","Response latency increased","Median reply time increased five days.","2026-07-27T17:00:00.000Z",.76),
  makeEvidence("ev-sf-forecast","acct-snowflake","salesforce","forecast","Close date moved","Close date slipped into next quarter.","2026-07-31T19:00:00.000Z",.98),
  makeEvidence("ev-sf-gong","acct-snowflake","gong","buyer-signal","Budget timing uncertain","Buyer cited budget timing risk.","2026-07-30T19:00:00.000Z",.9),
  makeEvidence("ev-pp-exec","acct-paypal","gong","executive-action","Executive alignment requested","Risk leader requested an executive value review.","2026-07-29T18:00:00.000Z",.89),
  makeEvidence("ev-pp-crm","acct-paypal","salesforce","stakeholder","Economic buyer identified","CRM identifies the modernization budget owner.","2026-07-30T18:00:00.000Z",.96),
  makeEvidence("ev-ft-renewal","acct-franklin","salesforce","renewal","Renewal milestone at risk","Legal review is behind plan.","2026-07-30T15:00:00.000Z",.94),
  makeEvidence("ev-ft-support","acct-franklin","support","issue","Open severity-two issue","Data export incident remains unresolved.","2026-07-31T13:00:00.000Z",.91),
  makeEvidence("ev-nv-usage","acct-nvidia","product-usage","adoption","Usage expanded","Three new teams activated workflows.","2026-07-29T14:00:00.000Z",.95),
  makeEvidence("ev-nv-crm","acct-nvidia","salesforce","opportunity","Global rollout opportunity","Expansion opportunity is active.","2026-07-30T14:00:00.000Z",.97),
  makeEvidence("ev-stale","acct-snowflake","manual","note","Old relationship note","Historical note with no recent confirmation.","2025-01-01T00:00:00.000Z",.7),
];
