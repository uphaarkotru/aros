import type {AgentContextPackage,ContextBudgetPolicy,ContextOmission,ContextSection} from "@/domain/llm-context/types";
import {compressAccountSummary} from "../compression/account-summary";
import {estimateContextTokens} from "./estimate-tokens";

export interface BudgetResult{context:AgentContextPackage;omissions:ContextOmission[];compressed:ContextSection[];before:number;after:number;hardLimitExceeded:boolean;}
const omit=(section:ContextSection,id:string,score:number,stage:string):ContextOmission=>({section,itemId:id,reason:"token-budget",relevanceScore:score,requiredByPolicy:false,omittedAtStage:stage});

export function enforceContextBudget(input:AgentContextPackage,policy:ContextBudgetPolicy):BudgetResult{
 const context:{[K in keyof AgentContextPackage]:AgentContextPackage[K]}={...input,relevantTimeline:[...input.relevantTimeline],supportingEvidence:[...input.supportingEvidence],governedDecisions:[...input.governedDecisions],stakeholderContext:[...input.stakeholderContext],productUsageContext:input.productUsageContext.map(item=>({...item,keyUseCases:[...item.keyUseCases],unusedCapabilities:[...item.unusedCapabilities]})),qualificationContext:[...input.qualificationContext],opportunityContext:input.opportunityContext?[...input.opportunityContext]:undefined,claims:[...input.claims],provenanceIndex:{...input.provenanceIndex},omissions:[...input.omissions]};
 const omissions:ContextOmission[]=[],compressed:ContextSection[]=[],before=estimateContextTokens(context,policy).estimatedInputTokens,target=Math.max(300,policy.targetTokenBudget);
 const over=()=>estimateContextTokens(context,policy).estimatedInputTokens>target;
 const removeLast=<T extends{id:string;relevanceScore:number}>(items:T[],section:ContextSection,stage:string,preserve:(item:T)=>boolean=()=>false)=>{const removable=[...items].filter(item=>!preserve(item)).sort((a,b)=>a.relevanceScore-b.relevanceScore||b.id.localeCompare(a.id))[0];if(!removable)return false;items.splice(items.findIndex(item=>item.id===removable.id),1);omissions.push(omit(section,removable.id,removable.relevanceScore,stage));return true;};
 while(over()&&removeLast(context.relevantTimeline,"timeline","budget-timeline",item=>item.type==="meeting")){}
 while(over()&&removeLast(context.supportingEvidence.map(item=>({...item,id:item.evidenceId})),"evidence","budget-evidence",item=>context.governedDecisions.some(decision=>decision.priority==="critical"&&decision.evidenceIds.includes(item.evidenceId)))){const omitted=omissions.at(-1);if(omitted)context.supportingEvidence=context.supportingEvidence.filter(item=>item.evidenceId!==omitted.itemId);}
 while(over()&&removeLast(context.governedDecisions,"decisions","budget-decisions",item=>item.priority==="critical"||item.approvalRequired)){}
 if(over()&&context.accountSummary.length>policy.compressionThresholds.summaryCharacters/2){context.accountSummary=compressAccountSummary(context.accountSummary);compressed.push("account-summary");}
 while(over()&&removeLast(context.stakeholderContext,"stakeholders","budget-stakeholders",item=>item.isPrimary)){}
 while(over()&&context.productUsageContext.length){const product=context.productUsageContext.at(-1)!;if(product.unusedCapabilities.length||product.keyUseCases.length){product.unusedCapabilities=[];product.keyUseCases=[];compressed.push("product-usage");}else if(context.productUsageContext.length<=1||!removeLast(context.productUsageContext,"product-usage","budget-products"))break;}
 while(over()&&context.qualificationContext.length>3){const item=[...context.qualificationContext].sort((a,b)=>a.relevanceScore-b.relevanceScore||a.key.localeCompare(b.key))[0];context.qualificationContext=context.qualificationContext.filter(value=>value.key!==item.key);omissions.push(omit("qualification",item.key,item.relevanceScore,"budget-low-confidence"));}
 while(over()&&context.claims.length){const removable=[...context.claims].filter(claim=>claim.trust!=="human-verified"&&claim.relevanceScore<.65).sort((a,b)=>a.relevanceScore-b.relevanceScore||a.id.localeCompare(b.id))[0];if(!removable)break;context.claims=context.claims.filter(claim=>claim.id!==removable.id);delete context.provenanceIndex[removable.id];omissions.push(omit("commercial",removable.id,removable.relevanceScore,"budget-low-confidence"));}
 context.omissions=[...context.omissions,...omissions];
 const after=estimateContextTokens(context,policy).estimatedInputTokens,hardLimitExceeded=after+policy.reservedPromptTokens+policy.reservedOutputTokens>policy.hardTokenLimit;
 return{context,omissions,compressed:[...new Set(compressed)],before,after,hardLimitExceeded};
}
