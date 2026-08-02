import type {ProviderDeploymentConfig} from "@/domain/provider-readiness/types";import {safeDeploymentConfig} from "@/llm-provider-readiness/configuration";
const development=safeDeploymentConfig("development"),production=safeDeploymentConfig("production"),test=safeDeploymentConfig("test");
export interface ProviderReadinessConfigFixture{fixtureId:string;description:string;config:ProviderDeploymentConfig;expectedValid:boolean;}
export const providerReadinessConfigFixtures:ProviderReadinessConfigFixture[]=[
 {fixtureId:"valid-development-mock",description:"Valid development configuration using MockProvider.",config:development,expectedValid:true},
 {fixtureId:"valid-test-replay",description:"Valid test configuration using ReplayProvider.",config:{...test,defaultProviderId:"replay",defaultModelId:"fixture-v1"},expectedValid:true},
 {fixtureId:"future-real-development",description:"Development configuration explicitly prepared for a future provider.",config:{...development,realProviderCallsAllowed:true},expectedValid:true},
 {fixtureId:"production-real-disabled",description:"Production fail-closed default.",config:production,expectedValid:true},
 {fixtureId:"missing-credential-reference",description:"Future real provider has no credential reference.",config:development,expectedValid:true},
 {fixtureId:"development-credential-production",description:"Development secret configured in production.",config:{...production,credentialReferences:[{referenceId:"dev",providerId:"future",credentialType:"api-key",source:"development-secret",locator:"fixture",environment:"production",required:true,allowLocalFallback:false,metadata:{}}]},expectedValid:false},
 {fixtureId:"disabled-provider",description:"Default provider is not enabled.",config:{...development,enabledProviders:[]},expectedValid:false},
 {fixtureId:"disabled-model",description:"Default model is not enabled.",config:{...development,enabledModels:[]},expectedValid:false},
 {fixtureId:"recording-production",description:"Recording is prohibited in production.",config:{...production,recordingPolicy:"allowed"},expectedValid:false},
 {fixtureId:"invalid-retry",description:"Retry attempts must be positive.",config:{...development,retryPolicy:{...development.retryPolicy,maximumAttempts:0}},expectedValid:false},
 {fixtureId:"invalid-timeout",description:"Timeout must be positive.",config:{...development,requestTimeoutMs:0},expectedValid:false},
 {fixtureId:"fallback-disabled",description:"Fallback remains disabled.",config:{...development,fallbackAllowed:false},expectedValid:true},
 {fixtureId:"fallback-explicit",description:"Fallback is explicitly allowed for synthetic fixtures.",config:{...development,fallbackAllowed:true},expectedValid:true},
];
