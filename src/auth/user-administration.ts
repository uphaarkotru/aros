import { randomUUID } from "node:crypto";
import type { IdentityRepository } from "./repository";
import { hashPassword } from "./password";
import { revenueRoles, type RevenueRole, type User, type UserStatus } from "./types";
import {legacyMembershipId,legacyRoleId} from "./store-migration";

export interface UserAdministrationInput {email:string;firstName:string;lastName:string;role:RevenueRole;managerUserId:string|null;status:UserStatus;password?:string}
export type UserAdministrationResult={ok:true;user:User}|{ok:false;error:string};

export function parseUserAdministrationInput(value:unknown,creating:boolean):UserAdministrationInput|null {
  if(!value||typeof value!=="object")return null;
  const input=value as Record<string,unknown>;
  const email=typeof input.email==="string"?input.email.trim().toLowerCase():"";
  const firstName=typeof input.firstName==="string"?input.firstName.trim():"";
  const lastName=typeof input.lastName==="string"?input.lastName.trim():"";
  const role=typeof input.role==="string"&&revenueRoles.includes(input.role as RevenueRole)?input.role as RevenueRole:null;
  const managerUserId=input.managerUserId===null||input.managerUserId===""?null:typeof input.managerUserId==="string"?input.managerUserId:null;
  const status=input.status==="ACTIVE"||input.status==="INACTIVE"?input.status:null;
  const password=typeof input.password==="string"?input.password:undefined;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!firstName||!lastName||firstName.length>80||lastName.length>80||!role||!status)return null;
  if((creating||password)&&(password?.length??0)<8)return null;
  return {email,firstName,lastName,role,managerUserId,status,password};
}

function validateManager(repository:IdentityRepository,organizationId:string,userId:string,managerUserId:string|null){
  if(!managerUserId)return null;
  if(managerUserId===userId)return "A user cannot report to themselves.";
  const manager=repository.findUserById(managerUserId);
  if(!manager||manager.organizationId!==organizationId||manager.status!=="ACTIVE")return "Select an active manager from this organization.";
  const visited=new Set<string>([userId]);let current:User|undefined=manager;
  while(current){if(visited.has(current.id))return "That reporting assignment would create a cycle.";visited.add(current.id);current=current.managerUserId?repository.findUserById(current.managerUserId):undefined}
  return null;
}

export function createOrganizationUser(repository:IdentityRepository,actor:User,input:UserAdministrationInput):UserAdministrationResult {
  if(!actor.isAdmin)return {ok:false,error:"Organization administrator access is required."};
  if(repository.findUserByEmail(input.email))return {ok:false,error:"A user with that email already exists."};
  const id=randomUUID(),managerError=validateManager(repository,actor.organizationId,id,input.managerUserId);if(managerError)return {ok:false,error:managerError};
  const now=new Date().toISOString();const user:User={id,organizationId:actor.organizationId,email:input.email,firstName:input.firstName,lastName:input.lastName,displayName:`${input.firstName} ${input.lastName}`,role:input.role,status:input.status,platformRole:null,managerUserId:input.managerUserId,teamId:null,regionId:null,timezone:null,avatarUrl:null,isDemoUser:false,isAdmin:false,passwordHash:hashPassword(input.password!),createdAt:now,updatedAt:now,lastLoginAt:null};repository.saveUser(user);const membershipId=legacyMembershipId(actor.organizationId,id);repository.update(store=>{store.memberships.push({id:membershipId,organizationId:actor.organizationId,userId:id,adminRole:"MEMBER",status:input.status==="ACTIVE"?"ACTIVE":"DEACTIVATED",joinedAt:now,createdAt:now,updatedAt:now});const roleId=legacyRoleId(actor.organizationId,input.role);store.roleAssignments.push({id:randomUUID(),organizationId:actor.organizationId,membershipId,organizationRoleDefinitionId:roleId,isPrimary:true,effectiveFrom:now,effectiveTo:null,createdAt:now,updatedAt:now});if(input.managerUserId)store.relationships.push({id:randomUUID(),organizationId:actor.organizationId,sourceMembershipId:membershipId,targetMembershipId:legacyMembershipId(actor.organizationId,input.managerUserId),relationshipType:"REPORTS_TO",isPrimary:true,effectiveFrom:now,effectiveTo:null,metadata:null,createdAt:now,updatedAt:now})});return {ok:true,user};
}

export function updateOrganizationUser(repository:IdentityRepository,actor:User,userId:string,input:UserAdministrationInput):UserAdministrationResult {
  if(!actor.isAdmin)return {ok:false,error:"Organization administrator access is required."};
  const existing=repository.findUserById(userId);if(!existing||existing.organizationId!==actor.organizationId)return {ok:false,error:"User not found."};
  const emailOwner=repository.findUserByEmail(input.email);if(emailOwner&&emailOwner.id!==userId)return {ok:false,error:"A user with that email already exists."};
  if(existing.id===actor.id&&input.status!=="ACTIVE")return {ok:false,error:"You cannot deactivate your own account."};
  const managerError=validateManager(repository,actor.organizationId,userId,input.managerUserId);if(managerError)return {ok:false,error:managerError};
  const updatedAt=new Date().toISOString(),user:User={...existing,email:input.email,firstName:input.firstName,lastName:input.lastName,displayName:`${input.firstName} ${input.lastName}`,role:input.role,status:input.status,managerUserId:input.managerUserId,passwordHash:input.password?hashPassword(input.password):existing.passwordHash,updatedAt};repository.saveUser(user);const membershipId=legacyMembershipId(actor.organizationId,userId);repository.update(store=>{store.memberships=store.memberships.map(item=>item.id===membershipId?{...item,status:input.status==="ACTIVE"?"ACTIVE":"DEACTIVATED",updatedAt}:item);store.roleAssignments=store.roleAssignments.map(item=>item.membershipId===membershipId&&item.effectiveTo===null?{...item,isPrimary:false,effectiveTo:updatedAt,updatedAt}:item);store.roleAssignments.push({id:randomUUID(),organizationId:actor.organizationId,membershipId,organizationRoleDefinitionId:legacyRoleId(actor.organizationId,input.role),isPrimary:true,effectiveFrom:updatedAt,effectiveTo:null,createdAt:updatedAt,updatedAt});store.relationships=store.relationships.map(item=>item.sourceMembershipId===membershipId&&item.relationshipType==="REPORTS_TO"&&item.effectiveTo===null?{...item,effectiveTo:updatedAt,updatedAt}:item);if(input.managerUserId)store.relationships.push({id:randomUUID(),organizationId:actor.organizationId,sourceMembershipId:membershipId,targetMembershipId:legacyMembershipId(actor.organizationId,input.managerUserId),relationshipType:"REPORTS_TO",isPrimary:true,effectiveFrom:updatedAt,effectiveTo:null,metadata:null,createdAt:updatedAt,updatedAt})});return {ok:true,user};
}
