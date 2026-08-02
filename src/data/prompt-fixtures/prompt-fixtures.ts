import type {PromptDefinition,PromptFixture} from "@/domain/prompts/types";import {initialPromptDefinitions,createPromptRegistry} from "@/prompt-registry";
const base=initialPromptDefinitions[0];
const variant=(promptId:string,changes:Partial<PromptDefinition>):PromptDefinition=>({...base,...changes,promptId,name:`Fixture ${promptId}`,version:changes.version??"1.0.0",metadata:{...base.metadata,testCoverage:[promptId],...changes.metadata}});
export const promptFixtureDefinitions:PromptDefinition[]=[
 variant("fixture-missing-placeholder",{status:"draft",taskInstructionTemplate:"No controlled task objective placeholder. {{contextPackage}}"}),
 variant("fixture-incompatible-context",{status:"draft",minimumContextVersion:"agent-context-v99"}),
 variant("fixture-incompatible-schema",{status:"draft",outputSchemaVersion:"decision-candidate-v99"}),
 variant("fixture-deprecated",{status:"deprecated"}),variant("fixture-experimental",{status:"experimental"}),
 variant("fixture-missing-citation",{status:"draft",evidenceInstructionTemplate:"No citations."}),
 variant("fixture-missing-uncertainty",{status:"draft",uncertaintyInstructionTemplate:"No uncertainty rules."}),
 variant("fixture-provider-syntax",{status:"draft",systemInstructionTemplate:"OpenAI assistant {{agentRole}} {{outputSchema}}"}),
 variant("renewal-assess-risk",{version:"1.1.0",status:"deprecated",taskInstructionTemplate:`${base.taskInstructionTemplate}\nPrefer the smallest reversible action.`,changelog:[...base.changelog,{version:"1.1.0",date:"2026-08-02T00:00:00.000Z",author:"CogniVit AROS",summary:"Regression comparison fixture.",changeType:"minor",expectedBehaviorImpact:"Recommendation wording only.",relatedEvaluationScenarioIds:["prompt-version-regression"]}]})
];
export const promptFixtureRegistry=createPromptRegistry([...initialPromptDefinitions,...promptFixtureDefinitions]);
const fixture=(fixtureId:string,accountId:string,agentType:string,taskType:string,promptId:string,promptVersion="1.0.0",reasonerFixtureId="valid",expectedBuildOutcome:"pass"|"fail"="pass",expectedEvaluationOutcome?:PromptFixture["expectedEvaluationOutcome"],extra:Partial<PromptFixture>={}):PromptFixture=>({fixtureId,name:fixtureId.replaceAll("-"," "),accountId,agentType,taskType,contextFixtureId:`context-${accountId}-${agentType}`,promptId,promptVersion,reasonerFixtureId,expectedBuildOutcome,expectedEvaluationOutcome,tags:[agentType,taskType],version:"prompt-fixtures-v1",...extra});
export const promptFixtures:PromptFixture[]=[
 fixture("coinbase-renewal-prompt","acct-coinbase","renewal-agent","assess-risk","renewal-assess-risk","1.0.0","valid","pass","pass-with-warnings"),
 fixture("paypal-expansion-prompt","acct-paypal","expansion-agent","identify-opportunity","expansion-identify-opportunity","1.0.0","valid","pass","pass-with-warnings"),
 fixture("nvidia-meeting-preparation-prompt","acct-nvidia","meeting-preparation-agent","prepare-meeting","meeting-prepare","1.0.0","valid","pass","pass-with-warnings"),
 fixture("franklin-relationship-prompt","acct-franklin","relationship-agent","review-relationship","relationship-review","1.0.0","valid","pass","pass-with-warnings"),
 fixture("snowflake-forecast-prompt","acct-snowflake","forecast-agent","review-forecast","forecast-review","1.0.0","valid","pass","pass-with-warnings"),
 fixture("executive-action-prompt","acct-coinbase","executive-agent","recommend-executive-action","executive-recommend-action","1.0.0","valid","pass","pass-with-warnings"),
 fixture("unsupported-agent-prompt","acct-coinbase","unsupported-agent","assess-risk","renewal-assess-risk","1.0.0","valid","fail"),
 fixture("unsupported-task-prompt","acct-coinbase","renewal-agent","prepare-meeting","renewal-assess-risk","1.0.0","valid","fail"),
 fixture("missing-placeholder-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-missing-placeholder","1.0.0","valid","fail"),
 fixture("incompatible-context-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-incompatible-context","1.0.0","valid","fail",undefined,{contextVersionOverride:"agent-context-v99"}),
 fixture("incompatible-schema-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-incompatible-schema","1.0.0","valid","fail",undefined,{outputSchemaVersionOverride:"decision-candidate-v99"}),
 fixture("deprecated-explicit-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-deprecated","1.0.0","valid","pass","pass-with-warnings"),
 fixture("experimental-blocked-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-experimental","1.0.0","valid","fail"),
 fixture("over-token-limit-prompt","acct-coinbase","renewal-agent","assess-risk","renewal-assess-risk","1.0.0","valid","fail",undefined,{buildPolicy:{maximumPromptTokens:100}}),
 fixture("missing-citation-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-missing-citation","1.0.0","valid","fail"),
 fixture("missing-uncertainty-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-missing-uncertainty","1.0.0","valid","fail"),
 fixture("provider-specific-prompt","acct-coinbase","renewal-agent","assess-risk","fixture-provider-syntax","1.0.0","valid","fail"),
 fixture("prompt-version-regression","acct-coinbase","renewal-agent","assess-risk","renewal-assess-risk","1.1.0","invented-finance","pass","pass-with-warnings"),
 fixture("grounded-through-scripted-reasoner","acct-paypal","expansion-agent","identify-opportunity","expansion-identify-opportunity","1.0.0","valid","pass","pass-with-warnings"),
 fixture("hallucinating-through-evaluator","acct-paypal","expansion-agent","identify-opportunity","expansion-identify-opportunity","1.0.0","invented-finance","pass","fail")
];
