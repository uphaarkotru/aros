import { randomUUID } from "node:crypto";
import { identityRepository } from "./repository.server";
import type { SecurityAuditEvent, User } from "./types";
export function recordAudit(actor:User,input:Omit<SecurityAuditEvent,"id"|"organizationId"|"actorUserId"|"actorRole"|"actorAdminRole"|"actorPlatformRole"|"timestamp">){const membership=identityRepository.read().memberships.find(item=>item.userId===actor.id&&item.organizationId===actor.organizationId),event:SecurityAuditEvent={id:randomUUID(),organizationId:membership?.organizationId??null,actorUserId:actor.id,actorRole:membership?actor.role:null,actorAdminRole:membership?.adminRole??null,actorPlatformRole:actor.platformRole,timestamp:new Date().toISOString(),...input};identityRepository.appendAudit(event);return event}
