import type {AgentReasoner,AgentReasonerResponseFormat} from "@/domain/agent-reasoning/types";import type {DecisionCandidate} from "@/domain/decisions/types";import {deterministicRuleReasoner,createFailureReasoner} from "@/agent-reasoning";

type Mutation=(candidate:DecisionCandidate)=>unknown;
function fixture(id:string,mutate:Mutation=(candidate)=>candidate,format:AgentReasonerResponseFormat="structured-object"):AgentReasoner{return{id:`fixture-${id}`,name:`Fixture: ${id}`,version:"1.0.0",supportedAgentTypes:deterministicRuleReasoner.supportedAgentTypes,supportedOutputSchemaVersions:deterministicRuleReasoner.supportedOutputSchemaVersions,reason(request,context){const base=deterministicRuleReasoner.reason(request,context),candidate=structuredClone(base.rawOutput) as DecisionCandidate,output=mutate(candidate);return{...base,rawOutput:format==="json-string"?JSON.stringify(output):output,format,metadata:{fixture:id},diagnostics:{steps:["created-grounded-baseline",`applied-${id}`],warningCount:id==="valid"?0:1,fixtureId:id}};}};}
const firstClaim=(candidate:DecisionCandidate)=>candidate.claimReferences?.[0];
export const reasonerFixtures:Record<string,AgentReasoner>={
 valid:fixture("valid"),
 "valid-json":fixture("valid-json",candidate=>candidate,"json-string"),
 "extra-fields":fixture("extra-fields",candidate=>({...candidate,unexpectedModelNote:"ignored"})),
 "missing-fields":fixture("missing-fields",candidate=>{const partial={...candidate} as Partial<DecisionCandidate>;delete partial.recommendedAction;return partial;},"partial-object"),
 "invalid-confidence":fixture("invalid-confidence",candidate=>({...candidate,proposedConfidence:1.4})),
 "negative-impact":fixture("negative-impact",candidate=>({...candidate,proposedBusinessImpactValue:-1})),
 "invented-evidence":fixture("invented-evidence",candidate=>({...candidate,evidenceIds:[...candidate.evidenceIds,"ev-invented"],claimReferences:candidate.claimReferences?.map((claim,index)=>index?claim:{...claim,evidenceIds:[...claim.evidenceIds,"ev-invented"]})})),
 "invented-fact":fixture("invented-fact",candidate=>({...candidate,factIds:[...(candidate.factIds??[]),"fact-invented"],claimReferences:candidate.claimReferences?.map((claim,index)=>index?claim:{...claim,factIds:[...claim.factIds,"fact-invented"]})})),
 "wrong-account":fixture("wrong-account",candidate=>({...candidate,accountId:"acct-other"})),
 "invented-finance":fixture("invented-finance",candidate=>({...candidate,proposedBusinessImpactValue:99_000_000,proposedBusinessImpact:"USD 99,000,000 at risk",claimReferences:candidate.claimReferences?.map((claim,index)=>index?claim:{...claim,text:"USD 99 million at risk"})})),
 "invented-date":fixture("invented-date",candidate=>{const claim=firstClaim(candidate);return{...candidate,claimReferences:claim?[{...claim,claimType:"date" as const,text:"Renewal is confirmed for 2035-01-01"},...(candidate.claimReferences?.slice(1)??[])]:candidate.claimReferences};}),
 "invented-stakeholder":fixture("invented-stakeholder",candidate=>{const claim=firstClaim(candidate);return{...candidate,claimReferences:claim?[{...claim,claimType:"stakeholder" as const,text:"Jordan Fabricated is the confirmed economic buyer"},...(candidate.claimReferences?.slice(1)??[])]:candidate.claimReferences};}),
 "unsupported-type":fixture("unsupported-type",candidate=>({...candidate,proposedType:"meeting-preparation"})),
 "generic-recommendation":fixture("generic-recommendation",candidate=>({...candidate,recommendedAction:"Follow up."})),
 "external-execution":fixture("external-execution",candidate=>({...candidate,recommendedAction:"The account owner already sent the email and updated CRM."})),
 "unsupported-certainty":fixture("unsupported-certainty",candidate=>({...candidate,claimReferences:candidate.claimReferences?.map((claim,index)=>index?claim:{...claim,certainty:"inferred" as const,text:`Definitely confirmed: ${claim.text}`})})),
 "conflict-omitted":fixture("conflict-omitted",candidate=>({...candidate,reasoningSummary:"All supplied information is final and confirmed.",claimReferences:candidate.claimReferences?.map(claim=>({...claim,conflictIds:[],certainty:"resolved" as const}))})),
 "missing-citations":fixture("missing-citations",candidate=>({...candidate,factIds:[],claimReferences:candidate.claimReferences?.map(claim=>({...claim,evidenceIds:[],factIds:[],lineageIds:[]}))})),
 "malformed-json":fixture("malformed-json",()=>"{not valid json","malformed-json"),
 "partial-output":fixture("partial-output",candidate=>({candidateId:candidate.candidateId,accountId:candidate.accountId}),"partial-object"),
 timeout:createFailureReasoner("timeout"),
 "provider-failure":createFailureReasoner("provider-failure")
};
export const reasoningFixtureIds=Object.keys(reasonerFixtures);
