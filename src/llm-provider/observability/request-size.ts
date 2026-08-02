import type {LLMRequest} from "@/domain/llm-provider/types";export const calculateRequestSizeBytes=(request:LLMRequest):number=>new TextEncoder().encode(JSON.stringify(request)).length;
