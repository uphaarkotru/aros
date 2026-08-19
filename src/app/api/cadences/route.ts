import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import { identityRepository } from "@/auth/repository.server";
import { authorizePermission } from "@/auth/authorization";
import { permissions } from "@/auth/permissions";
import {
  cadenceRepository,
  CadenceConflictError,
} from "@/db/cadence-repository";

export async function POST(request: Request) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!cadenceRepository)
    return NextResponse.json(
      { error: "Cadence persistence unavailable" },
      { status: 503 },
    );
  const effective = identityRepository.findUserById(identity.viewUser.id)!;
  if (
    !authorizePermission(
      effective,
      permissions.commitmentCreate,
      identityRepository,
      identity.organization.id,
    )
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: {
    opportunityId?: string;
    accountId?: string;
    idempotencyKey?: string;
    templateCode?: string;
    scope?: string;
    participants?: Array<{
      membershipId?: string;
      externalStakeholderId?: string;
      participationType?: string;
      participantRole: string;
      required: boolean;
    }>;
    agenda?: Array<{
      type: string;
      priority: number;
      title: string;
      rationale: string;
      evidence?: unknown[];
      recommendedDiscussion?: string;
      recommendedDecision?: string;
      visibility: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.opportunityId && !body.accountId)
    return NextResponse.json(
      { error: "An account or opportunity is required" },
      { status: 403 },
    );
  if (body.opportunityId && !identity.scope?.opportunityIds.includes(body.opportunityId))
    return NextResponse.json({ error: "Opportunity outside scope" }, { status: 403 });
  if (body.accountId && !identity.scope?.accountIds.includes(body.accountId))
    return NextResponse.json({ error: "Account outside scope" }, { status: 403 });
  const store = identityRepository.read(),
    activeTenantMemberships = new Set(
      store.memberships
        .filter(
          (item) =>
            item.organizationId === identity.organization.id &&
            item.status === "ACTIVE",
        )
        .map((item) => item.id),
    ),
    motionMembers = new Set(
      store.revenueTeamAssignments
        .filter(
          (item) =>
            item.organizationId === identity.organization.id &&
            (body.opportunityId ? item.opportunityId === body.opportunityId : item.accountId === body.accountId),
        )
        .map((item) => item.membershipId),
    );
  motionMembers.add(identity.membership.id);
  for (const relationship of store.relationships)
    if (
      relationship.organizationId === identity.organization.id &&
      relationship.relationshipType === "REPORTS_TO" &&
      !relationship.effectiveTo &&
      motionMembers.has(relationship.sourceMembershipId)
    )
      motionMembers.add(relationship.targetMembershipId);
  if (
    (body.participants ?? []).some(
      (item) =>
        item.membershipId &&
        (!activeTenantMemberships.has(item.membershipId) ||
          !motionMembers.has(item.membershipId)),
    )
  )
    return NextResponse.json(
      { error: "Participant outside tenant" },
      { status: 403 },
    );
  try {
    const result = await cadenceRepository.createCadence({
      idempotencyKey: String(body.idempotencyKey ?? crypto.randomUUID()),
      organizationId: identity.organization.id,
      templateCode: String(body.templateCode ?? "CUSTOM"),
      scope: String(body.scope ?? "INTERNAL"),
      accountId: body.accountId ? String(body.accountId) : null,
      opportunityId: body.opportunityId ? String(body.opportunityId) : null,
      participants: body.participants ?? [],
      agenda: Array.isArray(body.agenda) ? body.agenda : [],
      actorUserId: actor.id,
      actorMembershipId: identity.membership.id,
    });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cadence could not be created",
      },
      { status: error instanceof CadenceConflictError ? 409 : 400 },
    );
  }
}
