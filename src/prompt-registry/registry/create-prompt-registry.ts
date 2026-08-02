import type {PromptDefinition,PromptRegistry} from "@/domain/prompts/types";
import {agentPromptDefaults,promptVersions} from "../config";
export function createPromptRegistry(definitions:readonly PromptDefinition[],version=promptVersions.registryVersion):PromptRegistry{const keys=new Set<string>();for(const definition of definitions){const key=`${definition.promptId}@${definition.version}`;if(keys.has(key))throw new Error(`duplicate-version:${key}`);keys.add(key);}return Object.freeze({version,definitions:Object.freeze([...definitions]),defaults:agentPromptDefaults});}
