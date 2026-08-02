"use client";
import {useMemo,useState} from "react";
import type {AccountDigitalTwin} from "@/domain/accounts/account-digital-twin";
import type {AgentType} from "@/domain/agents/types";
import type {GovernedDecision} from "@/domain/decisions/types";
import type {ResolvedAccountContext} from "@/domain/reconciliation/types";
import {createSyntheticAgentTask,agentTaskNow} from "@/data/synthetic/agent-tasks";
import {buildAgentContext} from "@/llm-context";

const agents:AgentType[]=["renewal-agent","expansion-agent","relationship-agent","forecast-agent","executive-agent","meeting-preparation-agent"];
const pretty=(value:string)=>value.replaceAll("-"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export function ContextInspector({twins,contexts,decisions}:{twins:AccountDigitalTwin[];contexts:Record<string,ResolvedAccountContext>;decisions:GovernedDecision[]}){
 const[accountId,setAccountId]=useState(twins[0]?.accountId??"");
 const[agentType,setAgentType]=useState<AgentType>("renewal-agent");
 const[budget,setBudget]=useState(4000);
 const task=useMemo(()=>createSyntheticAgentTask(accountId,agentType),[accountId,agentType]);
 const result=useMemo(()=>buildAgentContext({agentType,task,accountTwin:twins.find(twin=>twin.accountId===accountId),resolvedContext:contexts[accountId],governedDecisions:decisions,policy:{targetTokenBudget:budget,hardTokenLimit:Math.max(budget+3000,4000)},now:agentTaskNow}),[accountId,agentType,budget,contexts,decisions,task,twins]);
 return <article className="context-inspector">
  <header className="accounts-header"><div><span className="eyebrow">DEVELOPMENT TOOL · NOT AVAILABLE IN PRODUCTION</span><h1>LLM Context Inspector</h1><p>Inspect deterministic, provider-neutral context selection before prompt construction.</p></div></header>
  <section className="twin-card inspector-controls" aria-label="Context controls">
   <label>Account<select aria-label="Account" value={accountId} onChange={event=>setAccountId(event.target.value)}>{twins.map(twin=><option value={twin.accountId} key={twin.accountId}>{twin.identity.name}</option>)}</select></label>
   <label>Agent type<select aria-label="Agent type" value={agentType} onChange={event=>setAgentType(event.target.value as AgentType)}>{agents.map(agent=><option value={agent} key={agent}>{pretty(agent)}</option>)}</select></label>
   <label>Task type<input aria-label="Task type" value={task.taskType.replaceAll("-"," ")} readOnly/></label>
   <label>Token budget<input aria-label="Token budget" type="number" min="1000" max="12000" step="250" value={budget} onChange={event=>setBudget(Number(event.target.value))}/></label>
  </section>
  {result.errors.length>0&&<section className="twin-card inspector-error" role="alert"><h2>Context build error</h2>{result.errors.map(error=><p key={error.code}>{error.code}: {error.message}</p>)}</section>}
  <section className="reconciliation-metrics inspector-metrics" aria-label="Context diagnostics"><span><strong>{result.tokenEstimate.estimatedInputTokens}</strong> input tokens</span><span><strong>{result.tokenEstimate.totalEstimatedTokens}</strong> total estimate</span><span><strong>{result.diagnostics.selectedItemCount}</strong> selected</span><span><strong>{result.excludedItems.length}</strong> omitted</span><span><strong>{result.diagnostics.conflictsIncluded}</strong> caveats</span><span><strong>{result.diagnostics.evidenceReferencesIncluded}</strong> evidence refs</span></section>
  {result.context&&<div className="inspector-grid">
   <section className="twin-card twin-wide"><h2>Account summary</h2><p>{result.context.accountSummary}</p></section>
   <section className="twin-card"><h2>Included context</h2><dl className="inspector-list"><div><dt>Claims</dt><dd>{result.context.claims.length}</dd></div><div><dt>Stakeholders</dt><dd>{result.context.stakeholderContext.length}</dd></div><div><dt>Timeline events</dt><dd>{result.context.relevantTimeline.length}</dd></div><div><dt>Decisions</dt><dd>{result.context.governedDecisions.length}</dd></div></dl><details><summary>Context package by section</summary><pre>{JSON.stringify({commercialContext:result.context.commercialContext,renewalContext:result.context.renewalContext,opportunityContext:result.context.opportunityContext,stakeholderContext:result.context.stakeholderContext,productUsageContext:result.context.productUsageContext,qualificationContext:result.context.qualificationContext,recentChanges:result.context.recentChanges,relevantTimeline:result.context.relevantTimeline},null,2)}</pre></details></section>
   <section className="twin-card"><h2>Caveats</h2>{result.context.conflictsAndCaveats.map(caveat=><article className="inspector-caveat" key={caveat.id}><strong>{caveat.severity}</strong><p>{caveat.description}</p></article>)}{!result.context.conflictsAndCaveats.length&&<p>No high-severity caveats.</p>}</section>
   <section className="twin-card"><h2>Supporting evidence IDs</h2><ul>{result.context.supportingEvidence.map(item=><li key={item.evidenceId}>{item.evidenceId} · {item.usageReason}</li>)}</ul>{!result.context.supportingEvidence.length&&<p>No relevant evidence references.</p>}</section>
   <section className="twin-card"><h2>Provenance references</h2><details><summary>{Object.keys(result.context.provenanceIndex).length} claim mappings</summary><pre>{JSON.stringify(result.context.provenanceIndex,null,2)}</pre></details></section>
   <section className="twin-card twin-wide"><h2>Omissions · {result.excludedItems.length}</h2><div className="omission-list">{result.excludedItems.map((item,index)=><span key={`${item.itemId}-${index}`}>{item.section} · {item.itemId} · {item.reason}</span>)}</div></section>
   <section className="twin-card twin-wide"><h2>Build diagnostics</h2><pre>{JSON.stringify({metadata:result.buildMetadata,tokenEstimate:result.tokenEstimate,diagnostics:result.diagnostics,warnings:result.warnings},null,2)}</pre></section>
  </div>}
 </article>;
}
