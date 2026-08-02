import type {ContextCandidate} from "../internal-types";
export function rankContextItems<T>(items:readonly ContextCandidate<T>[]){return [...items].sort((a,b)=>Number(b.required)-Number(a.required)||b.score.total-a.score.total||a.id.localeCompare(b.id));}

