import {randomUUID} from "node:crypto";
import {identityRepository} from "./repository.server";
import type {IdentityRepository} from "./repository";
import type {SecurityAuditEvent,User} from "./types";
import {primaryRoleContext} from "./tenant-model";
type AuditInput=Omit<SecurityAuditEvent,"id"|"organizationId"|"actorUserId"|"actorRole"|"actorAdminRole"|"actorPlatformRole"|"timestamp">;
export function buildAuditEvent(repository:IdentityRepository,actor:User,organizationId:string|null,input:AuditInput):SecurityAuditEvent{const membership=organizationId?repository.read().memberships.find(item=>item.userId===actor.id&&item.organizationId===organizationId):undefined,actorRole=membership?primaryRoleContext(repository,membership.id).template?.code??null:null;return{id:randomUUID(),organizationId,actorUserId:actor.id,actorRole,actorAdminRole:membership?.adminRole??null,actorPlatformRole:actor.platformRole,timestamp:new Date().toISOString(),...input}}
export function recordAudit(actor:User,input:AuditInput,organizationId:string|null=actor.organizationId){const event=buildAuditEvent(identityRepository,actor,organizationId,input);identityRepository.appendAudit(event);return event}
