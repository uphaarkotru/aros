import type { AIExecutionStageKey } from "@/domain/ai-developer-console/types";

export interface AIConsoleRedactionPolicy {
  maskCredentials: boolean; maskAuthorizationHeaders: boolean; maskEmailAddresses: boolean; maskPhoneNumbers: boolean; redactSensitiveNotes: boolean;
  includePromptContent: boolean; includeRawProviderOutput: boolean; includeSourceRecordIds: boolean; includeProviderTranslatedRequest: boolean;
  maximumDisplayedCharacters: number; maximumExportedCharacters: number; policyVersion: string;
}

export const aiDeveloperConsoleConfig = {
  consoleVersion: "1.0.0", traceSchemaVersion: "ai-execution-trace-v1", developmentOnly: true,
  stageOrder: ["source","reconciliation","digital-twin","context","prompt","provider","parsing","evaluation","eligibility","governance","economics","artifact","workspace"] as AIExecutionStageKey[],
  maximumSearchMatches: 100, exportVersion: "ai-console-export-v1",
};

export const screenRedactionPolicy: AIConsoleRedactionPolicy = { maskCredentials:true,maskAuthorizationHeaders:true,maskEmailAddresses:true,maskPhoneNumbers:true,redactSensitiveNotes:true,includePromptContent:true,includeRawProviderOutput:true,includeSourceRecordIds:true,includeProviderTranslatedRequest:false,maximumDisplayedCharacters:120_000,maximumExportedCharacters:0,policyVersion:"ai-console-screen-redaction-v1" };
export const copyRedactionPolicy: AIConsoleRedactionPolicy = { ...screenRedactionPolicy,includeProviderTranslatedRequest:false,maximumDisplayedCharacters:60_000,policyVersion:"ai-console-copy-redaction-v1" };
export const exportRedactionPolicy: AIConsoleRedactionPolicy = { ...screenRedactionPolicy,includeProviderTranslatedRequest:false,maximumDisplayedCharacters:0,maximumExportedCharacters:500_000,policyVersion:"ai-console-export-redaction-v1" };
export const storedTraceRedactionPolicy: AIConsoleRedactionPolicy = { ...screenRedactionPolicy,includeRawProviderOutput:false,includeProviderTranslatedRequest:false,maximumDisplayedCharacters:0,maximumExportedCharacters:250_000,policyVersion:"ai-console-storage-redaction-v1" };
export function isAIConsoleEnabled(environment=process.env.NODE_ENV): boolean { return environment !== "production"; }
