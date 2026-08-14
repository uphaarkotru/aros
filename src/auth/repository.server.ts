import {createDemoIdentityStore} from "./seed";
import {MemoryIdentityRepository} from "./repository";
import {PostgresIdentityRepository} from "@/db/postgres-identity-repository";
import {IdentityCommandRepository} from "@/db/identity-commands";

export type RuntimeIdentityRepository=MemoryIdentityRepository&{flush?:()=>Promise<void>;refresh?:()=>Promise<void>};

async function createRuntimeRepository():Promise<RuntimeIdentityRepository>{
 if(process.env.NODE_ENV==="test")return new MemoryIdentityRepository(createDemoIdentityStore());
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required. AROS does not fall back to identity.json or demo fixtures at runtime.");
 return PostgresIdentityRepository.connect(process.env.DATABASE_URL);
}

export const identityRepository=await createRuntimeRepository();
export const identityCommands=process.env.DATABASE_URL?new IdentityCommandRepository(process.env.DATABASE_URL):null;
export async function flushIdentityRepository(){await identityRepository.flush?.()}
