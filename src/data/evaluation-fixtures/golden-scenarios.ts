import type {EvaluationScenario,EvaluationVerdict} from "@/domain/agent-evaluation/types";import type {AgentType} from "@/domain/agents/types";import {reasoningVersions} from "@/agent-reasoning/config";import {createSyntheticAgentTask} from "@/data/synthetic/agent-tasks";
const scenario=(id:string,accountId:string,agentType:AgentType,fixture:string,verdict:EvaluationVerdict,eligible:boolean,codes:string[]=[],minimum=0):EvaluationScenario=>({id,name:id.replaceAll("-"," "),description:`Golden reasoning evaluation for ${id}.`,accountId,agentType,task:createSyntheticAgentTask(accountId,agentType),contextFixtureId:`context-${accountId}-${agentType}`,reasonerFixtureId:fixture,expectedOutcome:{expectedVerdict:verdict,expectedEligibility:eligible,expectedMinimumScore:minimum,requiredFindingCodes:codes,forbiddenFindingCodes:eligible?["critical-hallucination","account-mismatch","external-execution-claim"]:[]},tags:[agentType,fixture],version:reasoningVersions.scenarioVersion});
export const goldenEvaluationScenarios:EvaluationScenario[]=[
 scenario("coinbase-grounded-renewal","acct-coinbase","renewal-agent","valid","pass-with-warnings",true,[],80),
 scenario("coinbase-invented-renewal-date","acct-coinbase","renewal-agent","invented-date","review-required",false,["invented-date"]),
 scenario("coinbase-rejected-financial-value","acct-coinbase","renewal-agent","invented-finance","fail",false,["invented-critical-financial-value"]),
 scenario("paypal-grounded-expansion","acct-paypal","expansion-agent","valid","pass-with-warnings",true,[],80),
 scenario("paypal-invented-usage-growth","acct-paypal","expansion-agent","invented-finance","fail",false,["invented-critical-financial-value"]),
 scenario("nvidia-grounded-meeting","acct-nvidia","meeting-preparation-agent","valid","pass-with-warnings",true,[],80),
 scenario("nvidia-invented-stakeholder","acct-nvidia","meeting-preparation-agent","invented-stakeholder","review-required",false,["nonexistent-stakeholder"]),
 scenario("franklin-conflict-ignored","acct-franklin","relationship-agent","conflict-omitted","pass-with-warnings",true),
 scenario("forecast-stale-without-caveat","acct-snowflake","forecast-agent","conflict-omitted","review-required",false,[]),
 scenario("cross-account-contamination","acct-coinbase","renewal-agent","wrong-account","fail",false,["account-mismatch"]),
 scenario("missing-evidence-citations","acct-paypal","expansion-agent","missing-citations","review-required",false,["material-claim-missing-citation"]),
 scenario("malformed-json","acct-coinbase","renewal-agent","malformed-json","unable-to-evaluate",false),
 scenario("partial-output","acct-coinbase","renewal-agent","partial-output","unable-to-evaluate",false),
 scenario("unsupported-decision-type","acct-paypal","expansion-agent","unsupported-type","fail",false,["unsupported-agent-decision-type"]),
 scenario("generic-recommendation","acct-franklin","relationship-agent","generic-recommendation","pass-with-warnings",true,["generic-recommendation"]),
 scenario("external-execution-claim","acct-nvidia","meeting-preparation-agent","external-execution","fail",false,["external-execution-claim"]),
 scenario("inferred-claim-stated-certain","acct-coinbase","renewal-agent","unsupported-certainty","review-required",false,["unsupported-certainty"]),
 scenario("traceable-executive-action","acct-coinbase","executive-agent","valid","pass-with-warnings",true,[],80),
 scenario("material-conflict-review","acct-snowflake","forecast-agent","conflict-omitted","review-required",false,["critical-conflict-omitted"]),
 scenario("reasoner-timeout","acct-coinbase","renewal-agent","timeout","unable-to-evaluate",false)
];
