import { notFound } from "next/navigation";
import { ApplicationShell } from "@/components/application-shell";
import { isAIConsoleEnabled } from "@/ai-developer-console";
import { createCoinbaseAIConsoleTraces } from "@/ai-developer-console/fixtures/coinbase-traces";
import { AIDeveloperConsole } from "@/features/dev/ai-developer-console/ai-developer-console";
import { createCoinbaseRenewalWorkspaceFixture } from "@/data/renewal-intelligence-fixtures/coinbase";
import { buildAgentContext,simulateContextPolicy } from "@/llm-context";

export default function AIConsolePage(){if(!isAIConsoleEnabled())notFound();const fixture=createCoinbaseRenewalWorkspaceFixture(),builderInput={agentType:"renewal-agent" as const,task:fixture.quality.context.task,accountTwin:fixture.twin,resolvedContext:fixture.twin.reconciliation,governedDecisions:fixture.twin.activeDecisions,now:fixture.quality.sample.completedAt},build=buildAgentContext(builderInput),simulation=simulateContextPolicy({builderInput,candidatePolicy:{targetTokenBudget:3000,maximumItemsPerSection:{timeline:4,evidence:7,stakeholders:6}},now:fixture.quality.sample.completedAt}),traces=createCoinbaseAIConsoleTraces();if(build.context)for(const trace of traces)trace.contextStage.output={build,context:build.context};return <ApplicationShell active="accounts"><AIDeveloperConsole initialTraces={traces} policySimulation={simulation}/></ApplicationShell>;}
