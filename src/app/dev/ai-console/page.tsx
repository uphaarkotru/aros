import { notFound } from "next/navigation";
import { ApplicationShell } from "@/components/application-shell";
import { isAIConsoleEnabled } from "@/ai-developer-console";
import { createCoinbaseAIConsoleTraces } from "@/ai-developer-console/fixtures/coinbase-traces";
import { AIDeveloperConsole } from "@/features/dev/ai-developer-console/ai-developer-console";

export default function AIConsolePage(){if(!isAIConsoleEnabled())notFound();return <ApplicationShell active="accounts"><AIDeveloperConsole initialTraces={createCoinbaseAIConsoleTraces()}/></ApplicationShell>;}
