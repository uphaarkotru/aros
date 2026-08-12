import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createDemoIdentityStore, DEMO_PASSWORD } from "./seed";
import { hashPassword } from "./password";
import { MemoryIdentityRepository } from "./repository";
import type { IdentityStore } from "./types";
import {migrateIdentityStore} from "./store-migration";

class FileIdentityRepository extends MemoryIdentityRepository {
  constructor(private filePath:string){super(load(filePath))}
  private refresh(){this.store=load(this.filePath)}
  read(){this.refresh();return super.read()}
  findUserByEmail(email:string){this.refresh();return super.findUserByEmail(email)}
  findUserById(id:string){this.refresh();return super.findUserById(id)}
  findSessionByTokenHash(tokenHash:string){this.refresh();return super.findSessionByTokenHash(tokenHash)}
  saveUser(user:IdentityStore["users"][number]){this.refresh();super.saveUser(user)}
  saveSession(session:IdentityStore["sessions"][number]){this.refresh();super.saveSession(session)}
  deleteSession(id:string){this.refresh();super.deleteSession(id)}
  appendAudit(event:IdentityStore["auditEvents"][number]){this.refresh();super.appendAudit(event)}
  update(mutator:(store:IdentityStore)=>void){this.refresh();super.update(mutator)}
  protected persist(){mkdirSync(dirname(this.filePath),{recursive:true});const temporary=`${this.filePath}.${process.pid}.tmp`;writeFileSync(temporary,JSON.stringify(this.store,null,2),{mode:0o600});renameSync(temporary,this.filePath)}
}
function mergeMissing<T extends {id:string}>(current:T[],seeded:T[]){const ids=new Set(current.map(item=>item.id));return [...current,...seeded.filter(item=>!ids.has(item.id))]}
function load(path:string):IdentityStore {if(!existsSync(path))return createDemoIdentityStore();try{const store=migrateIdentityStore(JSON.parse(readFileSync(path,"utf8")) as IdentityStore),seed=createDemoIdentityStore(),demoPasswordHash=hashPassword(DEMO_PASSWORD,"aros-deterministic-demo-salt");store.users=mergeMissing(store.users,seed.users).map(user=>user.isDemoUser?{...user,passwordHash:demoPasswordHash,isAdmin:user.id==="user-org-admin"}:user);store.memberships=mergeMissing(store.memberships,seed.memberships);store.systemRoleTemplates=mergeMissing(store.systemRoleTemplates,seed.systemRoleTemplates);store.organizationRoles=mergeMissing(store.organizationRoles,seed.organizationRoles);store.roleAssignments=mergeMissing(store.roleAssignments,seed.roleAssignments);store.organizationalUnits=mergeMissing(store.organizationalUnits,seed.organizationalUnits);store.unitMemberships=mergeMissing(store.unitMemberships,seed.unitMemberships);store.relationships=mergeMissing(store.relationships,seed.relationships);store.revenueTeamAssignments=mergeMissing(store.revenueTeamAssignments,seed.revenueTeamAssignments);store.organizations=mergeMissing(store.organizations,seed.organizations);store.teams=mergeMissing(store.teams,seed.teams);store.regions=mergeMissing(store.regions,seed.regions);return store}catch{return createDemoIdentityStore()}}
const dataFile=process.env.AROS_IDENTITY_STORE_PATH??join(process.cwd(),".aros-data","identity.json");
export const identityRepository=new FileIdentityRepository(dataFile);
