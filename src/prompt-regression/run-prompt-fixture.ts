import type {EvaluationPolicy} from "@/domain/agent-evaluation/types";
import type {AgentReasoner} from "@/domain/agent-reasoning/types";
import type {AgentContextPackage} from "@/domain/llm-context/types";
import type {PromptBuildResult,PromptFixture,PromptFixtureRunResult,PromptRegistry} from "@/domain/prompts/types";
import {createAgentReasoningRequest,runAgentReasoning} from "@/agent-reasoning";
import {evaluateDecisionCandidate,isCandidateEligibleForGovernance} from "@/agent-evaluation";
import {buildPromptPackage} from "@/prompt-builder";
import {defaultPromptSelectionPolicy,getPromptDefinition} from "@/prompt-registry";
import {createPromptAuditEvent} from "@/prompt-registry/audit/create-prompt-audit-event";

const emptyBuild=():PromptBuildResult=>({errors:[{code:"missing-prompt",message:"Prompt selection failed.",recoverable:true}],warnings:[],tokenEstimate:{systemTokens:0,taskTokens:0,contextTokens:0,schemaTokens:0,safetyTokens:0,reservedOutputTokens:0,totalEstimatedTokens:0,withinLimit:true,estimationMethod:"not-run",margin:0},auditEvents:[]});

export function runPromptFixture({fixture,registry,context,reasoner,evaluatorPolicy,now}:{fixture:PromptFixture;registry:PromptRegistry;context?:AgentContextPackage;reasoner?:AgentReasoner;evaluatorPolicy:EvaluationPolicy;now:string}):PromptFixtureRunResult{
 const traceId=`prompt-fixture-${fixture.fixtureId}`;
 const start=createPromptAuditEvent({traceId,requestId:fixture.fixtureId,contextId:context?.contextId??"missing",promptId:fixture.promptId,promptVersion:fixture.promptVersion,eventType:"prompt-fixture-started",timestamp:now});
 const selection=getPromptDefinition({agentType:fixture.agentType,taskType:fixture.taskType,requestedVersion:fixture.promptVersion,promptId:fixture.promptId,registry,policy:{...defaultPromptSelectionPolicy,allowDeprecatedExplicit:true},contextVersion:fixture.contextVersionOverride??context?.contextVersion,outputSchemaVersion:fixture.outputSchemaVersionOverride,evaluationPolicyVersion:evaluatorPolicy.version,now,requestId:fixture.fixtureId,traceId,contextId:context?.contextId});
 let build=emptyBuild();let reasoning:PromptFixtureRunResult["reasoning"],evaluation:PromptFixtureRunResult["evaluation"];
 if(selection.definition&&context&&reasoner){
  const request=createAgentReasoningRequest({context,outputSchemaVersion:fixture.outputSchemaVersionOverride??selection.definition.outputSchemaVersion,now});
  build=buildPromptPackage({definition:selection.definition,request,context,policy:{maximumPromptTokens:20000,...fixture.buildPolicy},registry,registryVersion:registry.version,now});
  if(build.package){
   reasoning=runAgentReasoning({context,task:context.task,reasoner,promptPackage:build.package,outputSchemaVersion:build.package.outputSchemaVersion,now});
   if(reasoning.candidate)evaluation=evaluateDecisionCandidate({context,candidate:reasoning.candidate,reasoningMetadata:reasoning.metadata,policy:evaluatorPolicy,now});
  }
 }
 const buildPassed=Boolean(build.package),reasoningPassed=Boolean(reasoning?.candidate),evaluationPassed=Boolean(evaluation),eligibility=evaluation?isCandidateEligibleForGovernance({evaluation,policy:evaluatorPolicy}).eligible:false;
 const expectedOutcomeMatched=(fixture.expectedBuildOutcome==="pass")===buildPassed&&(!fixture.expectedEvaluationOutcome||evaluation?.verdict===fixture.expectedEvaluationOutcome);
 const findings=[...selection.errors.map(item=>item.code),...build.errors.map(item=>item.code),...(evaluation?.findings.map(item=>item.code)??[])],regressed=fixture.fixtureId.includes("regression")&&!expectedOutcomeMatched;
 const regression={fixtureId:fixture.fixtureId,promptVersion:fixture.promptVersion,buildPassed,reasoningPassed,evaluationPassed,score:evaluation?.overallScore??0,verdict:evaluation?.verdict??"not-run" as const,eligibility,expectedOutcomeMatched,findings,regressed,explanation:expectedOutcomeMatched?"Fixture matched its expected prompt outcome.":"Fixture outcome differs from its controlled expectation."};
 const completed=createPromptAuditEvent({traceId,requestId:fixture.fixtureId,contextId:context?.contextId??"missing",promptId:fixture.promptId,promptVersion:fixture.promptVersion,promptPackageId:build.package?.promptPackageId,eventType:regressed?"prompt-regression-detected":"prompt-fixture-completed",timestamp:now,details:{expectedOutcomeMatched}});
 return{fixture,selection,build,reasoning,evaluation,regression,auditEvents:[start,...selection.auditEvents,...build.auditEvents,completed]};
}
