import type { EvidenceSource } from "@/domain/evidence/types";

export type SourceRecordType = "salesforce-account"|"salesforce-opportunity"|"salesforce-contact"|"gong-call"|"email-interaction"|"calendar-meeting"|"product-usage"|"support-event"|"contract"|"external-news"|"manual-verification";
export interface SalesforceAccountPayload { name:string;ownerName:string;annualContractValue:number;renewalDate:string;currency:"USD"; }
export interface SalesforceOpportunityPayload { opportunityId:string;name:string;stage:string;amount:number;currency:"USD";closeDate:string;forecastCategory:string;nextStep:string; }
export interface SalesforceContactPayload { contactId:string;name:string;title:string;role:string;lastActivityAt:string; }
export interface GongCallPayload { occurredAt:string;durationMinutes:number;participants:string[];summary?:string;sentiment?:"positive"|"neutral"|"negative";outcome?:string; }
export interface EmailInteractionPayload { occurredAt:string;participants:string[];subject:string;stakeholderId?:string;stakeholderTitle?:string;sentiment?:"positive"|"neutral"|"negative"; }
export interface CalendarMeetingPayload { occurredAt:string;participants:string[];title:string;status:"scheduled"|"completed"|"cancelled"; }
export interface ProductUsagePayload { productId:string;windowStart:string;windowEnd:string;activeUsers:number;licensedUsers:number;adoptionRate:number;usageTrend:"improving"|"stable"|"declining"; }
export interface SupportEventPayload { severity:"low"|"medium"|"high"|"critical";status:"open"|"resolved";title:string;occurredAt:string; }
export interface ContractPayload { annualContractValue:number;totalContractValue:number;currency:"USD";startDate:string;endDate:string;renewalDate:string;products:string[]; }
export interface ExternalNewsPayload { headline:string;claim:string;publishedAt:string; }
export interface ManualVerificationPayload { factType:string;fieldPath:string;value:string|number|boolean|string[];verifiedBy:string;reason:string; }
export type SourcePayload = SalesforceAccountPayload|SalesforceOpportunityPayload|SalesforceContactPayload|GongCallPayload|EmailInteractionPayload|CalendarMeetingPayload|ProductUsagePayload|SupportEventPayload|ContractPayload|ExternalNewsPayload|ManualVerificationPayload;
export interface SourceRecord<T extends SourcePayload=SourcePayload>{id:string;accountId:string;source:EvidenceSource;sourceRecordType:SourceRecordType;sourceRecordId:string;observedAt:string;effectiveAt:string;ingestedAt:string;lastModifiedAt:string;payload:T;schemaVersion:string;reliability:number;synthetic:boolean;metadata:Record<string,string|number|boolean|null>;}

