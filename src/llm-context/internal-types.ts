import type {ContextItemScore,ContextSection,OmissionReason} from "@/domain/llm-context/types";
export interface ContextCandidate<T=unknown>{id:string;section:ContextSection;value:T;score:ContextItemScore;required:boolean;trust:"resolved"|"human-verified"|"inferred"|"stale"|"disputed"|"unsupported";factIds:string[];evidenceIds:string[];conflictIds:string[];sourceRecordIds:string[];lineageIds:string[];estimatedTokens:number;omissionReason?:OmissionReason;}

