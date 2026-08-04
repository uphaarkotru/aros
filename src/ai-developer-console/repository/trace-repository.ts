import type { AIConsoleTraceFilter, AIExecutionTrace } from "@/domain/ai-developer-console/types";
import { filterAIExecutionTraces } from "../selectors/trace-selectors";
import { redactAIConsoleValue } from "../redaction/redact";
import { storedTraceRedactionPolicy } from "../config";

export interface AIExecutionTraceRepository { save(trace:AIExecutionTrace):Promise<void>; load(traceId:string):Promise<AIExecutionTrace|undefined>; list(filter?:AIConsoleTraceFilter):Promise<AIExecutionTrace[]>; }
export function createStoredTraceSnapshot(trace:AIExecutionTrace):AIExecutionTrace {const artifactId=trace.artifactStage.output?.artifact.artifactId,safe=redactAIConsoleValue(trace,storedTraceRedactionPolicy) as AIExecutionTrace;safe.artifactStage={...safe.artifactStage,output:undefined,inputReferences:artifactId?[artifactId]:safe.artifactStage.inputReferences,diagnostics:{...safe.artifactStage.diagnostics,artifactReferencedNotDuplicated:Boolean(artifactId)}};return safe;}
export class InMemoryAIExecutionTraceRepository implements AIExecutionTraceRepository { private readonly traces=new Map<string,AIExecutionTrace>();async save(trace:AIExecutionTrace){this.traces.set(trace.traceId,structuredClone(createStoredTraceSnapshot(trace)));}async load(traceId:string){const value=this.traces.get(traceId);return value?structuredClone(value):undefined;}async list(filter:AIConsoleTraceFilter={}){return filterAIExecutionTraces([...this.traces.values()].map(item=>structuredClone(item)),filter);} }
