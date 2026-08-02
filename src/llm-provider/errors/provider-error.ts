import type {LLMProviderErrorCode} from "@/domain/llm-provider/types";
export class LLMProviderError extends Error{readonly code:LLMProviderErrorCode;readonly recoverable:boolean;constructor(code:LLMProviderErrorCode,message:string,recoverable=true){super(message);this.name="LLMProviderError";this.code=code;this.recoverable=recoverable;}}
export const toProviderError=(error:unknown):LLMProviderError=>error instanceof LLMProviderError?error:new LLMProviderError("transient-failure",error instanceof Error?error.message:"Provider execution failed.");
