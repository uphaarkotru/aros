import "server-only";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AIConsoleTraceFilter, AIExecutionTrace } from "@/domain/ai-developer-console/types";
import { filterAIExecutionTraces } from "../selectors/trace-selectors";
import { containsAIConsoleSecret, stableStringify } from "../redaction/redact";
import type { AIExecutionTraceRepository } from "./trace-repository";
import { createStoredTraceSnapshot } from "./trace-repository";

const safeName=(value:string)=>value.replace(/[^a-zA-Z0-9._-]/g,"_");
export class FileSystemAIExecutionTraceRepository implements AIExecutionTraceRepository { constructor(private readonly directory:string){}private filename(traceId:string){return path.join(this.directory,`${safeName(traceId)}.json`);}async save(trace:AIExecutionTrace){const content=stableStringify(createStoredTraceSnapshot(trace));if(containsAIConsoleSecret(content))throw new Error("ai-console-trace-sensitive-material");await mkdir(this.directory,{recursive:true});await writeFile(this.filename(trace.traceId),content,{encoding:"utf8",flag:"wx"}).catch(error=>{if((error as NodeJS.ErrnoException).code==="EEXIST")throw new Error("ai-console-trace-immutable");throw error;});}async load(traceId:string){try{return JSON.parse(await readFile(this.filename(traceId),"utf8")) as AIExecutionTrace;}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return undefined;throw error;}}async list(filter:AIConsoleTraceFilter={}){try{const files=(await readdir(this.directory)).filter(file=>file.endsWith(".json")).sort(),traces=await Promise.all(files.map(async file=>JSON.parse(await readFile(path.join(this.directory,file),"utf8")) as AIExecutionTrace));return filterAIExecutionTraces(traces,filter);}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return[];throw error;}}}
