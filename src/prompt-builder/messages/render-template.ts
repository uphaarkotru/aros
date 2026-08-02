import type {PromptPlaceholder} from "@/domain/prompts/types";
import {allowedPromptPlaceholders,extractPlaceholders} from "@/prompt-registry";
export function renderPromptTemplate(template:string,variables:Record<PromptPlaceholder,string>):string{for(const placeholder of extractPlaceholders(template))if(!allowedPromptPlaceholders.includes(placeholder as PromptPlaceholder))throw new Error(`unknown-placeholder:${placeholder}`);return template.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g,(_,key:string)=>variables[key as PromptPlaceholder]).trim();}
