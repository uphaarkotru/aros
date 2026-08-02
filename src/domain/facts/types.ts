import type { EvidenceSource } from "@/domain/evidence/types";
export type FactType="account-name"|"owner"|"annual-contract-value"|"total-contract-value"|"contract-start-date"|"contract-end-date"|"renewal-date"|"opportunity-stage"|"opportunity-value"|"close-date"|"forecast-category"|"executive-sponsor"|"champion"|"stakeholder-title"|"stakeholder-engagement"|"stakeholder-sentiment"|"relationship-strength"|"product-adoption"|"product-usage-trend"|"support-severity"|"security-review-status"|"legal-review-status"|"procurement-status"|"meeting-occurrence"|"meeting-outcome"|"strategic-initiative"|"meddpicc-field"|"account-health-driver";
export type FactValue=string|number|boolean|string[];
export type FactValueType="string"|"number"|"boolean"|"date"|"enum"|"money"|"percentage"|"collection"|"relationship"|"status";
export type VerificationStatus="observed"|"inferred"|"corroborated"|"human-verified"|"disputed"|"stale"|"unsupported";
export type DerivationType="direct"|"normalized"|"calculated"|"inferred"|"human-override";
export interface AccountFact{id:string;accountId:string;factType:FactType;fieldPath:string;value:FactValue;valueType:FactValueType;unit?:string;currency?:string;effectiveAt:string;observedAt:string;ingestedAt:string;source:EvidenceSource;sourceRecordId:string;sourceRecordType:string;reliability:number;authorityScore:number;confidence:number;verificationStatus:VerificationStatus;derivationType:DerivationType;lineage:string[];expiresAt?:string;metadata:Record<string,string|number|boolean|null>;}

