import {buildAgentContext} from "@/llm-context";import {accountDigitalTwins} from "./final-account-digital-twins";import {resolvedAccountContexts} from "./resolved-account-contexts";import {syntheticAgentTasks,agentTaskNow} from "./agent-tasks";
export const syntheticAgentContextResults=syntheticAgentTasks.map(task=>buildAgentContext({agentType:task.agentType,task,accountTwin:accountDigitalTwins.find(twin=>twin.accountId===task.accountId),resolvedContext:resolvedAccountContexts[task.accountId],governedDecisions:accountDigitalTwins.flatMap(twin=>twin.activeDecisions),now:agentTaskNow}));

