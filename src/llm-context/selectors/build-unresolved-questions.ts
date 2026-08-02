import type {AccountDigitalTwin} from "@/domain/accounts/account-digital-twin";import type {ResolvedAccountContext} from "@/domain/reconciliation/types";

export function buildUnresolvedQuestions(twin:AccountDigitalTwin,resolved:ResolvedAccountContext){
 const qualification=twin.meddpicc.fields.filter(field=>["missing","stale","assumed"].includes(field.status)).map(field=>field.key==="economic-buyer"?"Who is the confirmed economic buyer?":field.key==="decision-process"?"What is the customer’s confirmed decision process?":`How will ${field.key.replaceAll("-"," ")} be confirmed?`);
 const questions=[...qualification,...resolved.unresolvedConflicts.map(conflict=>`Which source has the correct ${conflict.factType.replaceAll("-"," ")}?`),...(twin.opportunities.some(item=>!item.nextStep)?["What is the confirmed next step for the open opportunity?"]:[]),...(!twin.stakeholderMap.executiveSponsor?["Who is the confirmed executive sponsor?"]:[]),...(twin.renewalProfile&&!twin.renewalProfile.nextMilestone?["Who owns the next renewal milestone?"]:[]),...twin.unresolvedQuestions.map(question=>question==="Who is the economic buyer?"?"Who is the confirmed economic buyer?":question)];
 return [...new Set(questions)].slice(0,8);
}
