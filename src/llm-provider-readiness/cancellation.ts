import {LLMProviderError} from "@/llm-provider/errors/provider-error";
export function throwIfAborted(signal?:AbortSignal):void{if(signal?.aborted)throw new LLMProviderError("cancelled","Provider request was cancelled.",false);}
export function abortableDelay(milliseconds:number,signal?:AbortSignal):Promise<void>{throwIfAborted(signal);return new Promise((resolve,reject)=>{const timer=setTimeout(resolve,milliseconds);signal?.addEventListener("abort",()=>{clearTimeout(timer);reject(new LLMProviderError("cancelled","Provider request was cancelled.",false));},{once:true});});}
