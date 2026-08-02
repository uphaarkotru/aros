import type { ActorType, AuditEvent, AuditEventType } from "@/domain/decisions/types";

function stablePart(value: string): string { let hash = 0; for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return hash.toString(36); }
export function createAuditEvent(input: { decisionId: string; candidateId: string; actorType: ActorType; actorId: string; eventType: AuditEventType; timestamp: string; traceId: string; details?: Record<string, string | number | boolean> }): AuditEvent {
  return { ...input, id: `audit-${stablePart(`${input.decisionId}|${input.candidateId}|${input.eventType}|${input.timestamp}|${input.actorId}`)}`, details: input.details ?? {} };
}
