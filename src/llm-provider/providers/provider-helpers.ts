import type {LLMHealthCheckResult,LLMRequest,LLMValidationResult} from "@/domain/llm-provider/types";import {validateLLMRequest} from "../contracts/validate-llm-request";
export const providerValidation=(request:LLMRequest,now:string):Promise<LLMValidationResult>=>Promise.resolve(validateLLMRequest(request,now));
export const healthy=(provider:string,now:string):Promise<LLMHealthCheckResult>=>Promise.resolve({provider,healthy:true,status:"healthy",checkedAt:now,message:"Synthetic provider is ready.",diagnostics:{synthetic:true}});
