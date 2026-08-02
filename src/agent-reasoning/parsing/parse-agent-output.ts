import type {AgentOutputParseIssue,AgentOutputParseResult,AgentReasonerResponse} from "@/domain/agent-reasoning/types";import type {AgentType} from "@/domain/agents/types";import type {DecisionCandidate,DecisionClaim,DecisionClaimCertainty,DecisionClaimType,DecisionType} from "@/domain/decisions/types";import {reasoningVersions,supportedAgentTypes} from "../config";

const decisionTypes:DecisionType[]=["renewal-risk","expansion-opportunity","meeting-preparation","relationship-risk","forecast-risk","executive-action"],claimTypes:DecisionClaimType[]=["account-identity","financial-impact","date","stakeholder","relationship","product-usage","renewal","opportunity","forecast","meeting","recommendation-rationale","risk","qualification","summary"],certainties:DecisionClaimCertainty[]=["observed","resolved","corroborated","inferred","disputed","uncertain"],knownFields=["candidateId","accountId","proposedType","proposedCategory","proposedTitle","proposedSummary","whatHappened","whyItMatters","evidenceIds","factIds","proposedBusinessImpact","proposedBusinessImpactValue","proposedConfidence","recommendedAction","alternativeActions","responsibleAgent","requiredHumanDecision","generatedAt","dueAt","meetingTime","reasoningSummary","claimReferences","modelMetadata","contextMetadata"];
const issue=(code:string,field:string,message:string,severity:"warning"|"error"="error"):AgentOutputParseIssue=>({code,field,message,severity});
const strings=(value:unknown)=>Array.isArray(value)&&value.every(item=>typeof item==="string");
const dedupe=(value:unknown)=>strings(value)?[...new Set(value)]:[];
function parseClaims(value:unknown,errors:AgentOutputParseIssue[],warnings:AgentOutputParseIssue[]):DecisionClaim[]{
 if(!Array.isArray(value)){errors.push(issue("missing-claim-references","claimReferences","Material claim references are required."));return[];}
 const claims:DecisionClaim[]=[],ids=new Set<string>();
 for(const [index,raw] of value.entries()){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)){errors.push(issue("invalid-claim",`claimReferences.${index}`,"Claim must be an object."));continue;}
  const claim=raw as Partial<DecisionClaim>;
  if(typeof claim.claimId!=="string"||!claim.claimId.trim()){errors.push(issue("invalid-claim-id",`claimReferences.${index}.claimId`,`Claim ID is required.`));continue;}
  if(ids.has(claim.claimId)){errors.push(issue("duplicate-claim-id",`claimReferences.${index}.claimId`,`Claim IDs must be unique.`));continue;}
  ids.add(claim.claimId);
  if(!claimTypes.includes(claim.claimType as DecisionClaimType))errors.push(issue("invalid-claim-type",`claimReferences.${index}.claimType`,`Claim type is unsupported.`));
  if(!certainties.includes(claim.certainty as DecisionClaimCertainty))errors.push(issue("invalid-claim-certainty",`claimReferences.${index}.certainty`,`Claim certainty is unsupported.`));
  if(typeof claim.text!=="string"||!claim.text.trim())errors.push(issue("invalid-claim-text",`claimReferences.${index}.text`,`Claim text is required.`));
  const evidenceIds=dedupe(claim.evidenceIds),factIds=dedupe(claim.factIds);
  if(Array.isArray(claim.evidenceIds)&&evidenceIds.length<claim.evidenceIds.length)warnings.push(issue("duplicate-citation-normalized",`claimReferences.${index}.evidenceIds`,`Duplicate evidence citations were removed.`,"warning"));
  claims.push({...claim,evidenceIds,factIds,conflictIds:dedupe(claim.conflictIds),lineageIds:dedupe(claim.lineageIds)} as DecisionClaim);
 }
 return claims;
}
export function parseAgentOutput({response,outputSchemaVersion,now}:{response:AgentReasonerResponse;outputSchemaVersion:string;now:string}):AgentOutputParseResult{
 const errors:AgentOutputParseIssue[]=[],warnings:AgentOutputParseIssue[]=[];let raw:unknown=response.rawOutput;
 if(outputSchemaVersion!==reasoningVersions.decisionCandidateSchemaVersion)errors.push(issue("unsupported-schema-version","outputSchemaVersion",`Unsupported schema version ${outputSchemaVersion}.`));
 if(response.format==="json-string"||response.format==="malformed-json"){if(typeof raw!=="string")errors.push(issue("invalid-output-format","rawOutput","JSON output must be a string."));else try{raw=JSON.parse(raw);}catch{errors.push(issue("malformed-json","rawOutput","Output is not valid JSON."));}}
 if(!raw||typeof raw!=="object"||Array.isArray(raw)){if(!errors.some(item=>item.code==="malformed-json"))errors.push(issue("invalid-output","rawOutput","Output must be an object."));return{success:false,errors,warnings,rawOutputMetadata:{format:response.format,size:typeof response.rawOutput==="string"?response.rawOutput.length:0,unknownFields:[]},schemaVersion:outputSchemaVersion,parsedAt:now};}
 const object=raw as Record<string,unknown>,unknownFields=Object.keys(object).filter(key=>!knownFields.includes(key));if(unknownFields.length)warnings.push(issue("unknown-fields","output",`Ignored unknown fields: ${unknownFields.join(", ")}.`,"warning"));
 for(const field of ["candidateId","accountId","proposedCategory","proposedTitle","proposedSummary","whatHappened","whyItMatters","proposedBusinessImpact","recommendedAction","responsibleAgent","generatedAt","reasoningSummary"] as const)if(typeof object[field]!=="string"||!(object[field] as string).trim())errors.push(issue("missing-required-field",field,`${field} is required.`));
 if(!decisionTypes.includes(object.proposedType as DecisionType))errors.push(issue("invalid-decision-type","proposedType","Decision type is unsupported."));
 if(typeof object.proposedConfidence!=="number"||!Number.isFinite(object.proposedConfidence)||object.proposedConfidence<0||object.proposedConfidence>1)errors.push(issue("invalid-confidence","proposedConfidence","Confidence must be between 0 and 1."));
 if(typeof object.proposedBusinessImpactValue!=="number"||!Number.isFinite(object.proposedBusinessImpactValue)||object.proposedBusinessImpactValue<0)errors.push(issue("invalid-financial-impact","proposedBusinessImpactValue","Financial impact must be nonnegative."));
 if(typeof object.requiredHumanDecision!=="boolean")errors.push(issue("invalid-human-decision","requiredHumanDecision","Human-decision requirement must be boolean."));
 if(!strings(object.alternativeActions))errors.push(issue("invalid-alternative-actions","alternativeActions","Alternative actions must be strings."));
 const evidenceIds=dedupe(object.evidenceIds),factIds=dedupe(object.factIds);if(!evidenceIds.length)errors.push(issue("missing-evidence","evidenceIds","At least one evidence citation is required."));if(Array.isArray(object.evidenceIds)&&evidenceIds.length<object.evidenceIds.length)warnings.push(issue("duplicate-citation-normalized","evidenceIds","Duplicate evidence citations were removed.","warning"));
 for(const field of ["generatedAt","dueAt","meetingTime"] as const)if(object[field]!==undefined&&(typeof object[field]!=="string"||Number.isNaN(Date.parse(object[field] as string))))errors.push(issue("invalid-timestamp",field,`${field} must be a valid timestamp.`));
 const claims=parseClaims(object.claimReferences,errors,warnings),metadata=object.modelMetadata;if(!metadata||typeof metadata!=="object"||(metadata as {synthetic?:unknown}).synthetic!==true)errors.push(issue("invalid-model-metadata","modelMetadata","Synthetic model metadata is required."));
 const contextMetadata=object.contextMetadata;if(!contextMetadata||typeof contextMetadata!=="object")errors.push(issue("invalid-context-metadata","contextMetadata","Context metadata is required."));
 const normalizedOutput={...object,evidenceIds,factIds,claimReferences:claims};const success=errors.length===0;
 return{success,candidate:success?normalizedOutput as unknown as DecisionCandidate:undefined,normalizedOutput,errors,warnings,rawOutputMetadata:{format:response.format,size:JSON.stringify(response.rawOutput).length,unknownFields},schemaVersion:outputSchemaVersion,parsedAt:now};
}
export const isSupportedAgentType=(value:string):value is AgentType=>supportedAgentTypes.includes(value as AgentType);
