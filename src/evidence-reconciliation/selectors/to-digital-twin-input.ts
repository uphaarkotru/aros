import type { ResolvedAccountContext,ResolvedAccountFact } from "@/domain/reconciliation/types";import type { FactType,FactValue } from "@/domain/facts/types";
export interface AccountDigitalTwinResolvedInput{context:ResolvedAccountContext;authoritative:Partial<Record<FactType,FactValue>>;withheldFieldPaths:string[];}
export function usableFact(fact:ResolvedAccountFact|undefined){return Boolean(fact&&fact.resolutionMethod!=="unresolved"&&fact.freshnessStatus!=="expired"&&fact.confidence.total>=.4);}
export function toDigitalTwinInput(context:ResolvedAccountContext):AccountDigitalTwinResolvedInput{const authoritative:Partial<Record<FactType,FactValue>>={},withheldFieldPaths:string[]=[];for(const fact of context.facts){if(usableFact(fact))authoritative[fact.factType]=fact.value;else withheldFieldPaths.push(fact.fieldPath);}return{context,authoritative,withheldFieldPaths};}
export function resolvedValue<T extends FactValue>(context:ResolvedAccountContext,type:FactType,path?:string):T|undefined{const fact=context.facts.find(f=>f.factType===type&&(!path||f.fieldPath===path));return usableFact(fact)?fact?.value as T:undefined;}

