import type {LLMRetryPolicy,ModelDefinition} from "@/domain/llm-provider/types";
export const llmProviderVersions={adapterVersion:"llm-adapter-v1",requestVersion:"llm-request-v1",responseVersion:"llm-response-v1",modelRegistryVersion:"model-registry-v1",retryPolicyVersion:"llm-retry-policy-v1",fixtureVersion:"llm-provider-fixtures-v1"} as const;
export const defaultRetryPolicy:LLMRetryPolicy={version:llmProviderVersions.retryPolicyVersion,maximumAttempts:3,retryableErrorCodes:["timeout","rate-limit","provider-unavailable","transient-failure"],initialDelayMs:100,backoffMultiplier:2,maximumDelayMs:1000,jitter:false};
export const syntheticModelDefinitions:ModelDefinition[]=[
 {provider:"mock",modelId:"aros-mock-v1",maxContextTokens:24000,maxOutputTokens:4000,supportsJSON:true,supportsStreaming:false,supportsToolCalling:false,status:"active",synthetic:true,metadata:{purpose:"deterministic testing"}},
 {provider:"replay",modelId:"fixture-v1",maxContextTokens:24000,maxOutputTokens:4000,supportsJSON:true,supportsStreaming:false,supportsToolCalling:false,status:"active",synthetic:true,metadata:{purpose:"recorded fixture replay"}},
 {provider:"failure",modelId:"failure-v1",maxContextTokens:24000,maxOutputTokens:4000,supportsJSON:true,supportsStreaming:false,supportsToolCalling:false,status:"experimental",synthetic:true,metadata:{purpose:"failure simulation"}}
];
export const defaultModelByProvider:Record<string,string>={mock:"aros-mock-v1",replay:"fixture-v1",failure:"failure-v1"};
