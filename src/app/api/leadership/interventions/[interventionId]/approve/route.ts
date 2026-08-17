import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
import { authorizePermission } from "@/auth/authorization";
import { permissions } from "@/auth/permissions";
import {
  leadershipRepository,
  LeadershipConflictError,
} from "@/db/leadership-repository";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ interventionId: string }> },
) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!leadershipRepository)
    return NextResponse.json(
      { error: "Persistence unavailable" },
      { status: 503 },
    );
  if (identity.effectiveRole !== "VP_SALES" && identity.effectiveRole !== "CRO")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const effective = identityRepository.findUserById(identity.viewUser.id),
    membership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    );
  if (
    !effective ||
    !membership ||
    !authorizePermission(
      effective,
      permissions.leadershipDecision,
      identityRepository,
      identity.organization.id,
    )
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { interventionId } = await params,
    level = identity.effectiveRole === "CRO" ? "CRO" : "VP";
  if (
    !(await leadershipRepository.getIntervention(
      identity.organization.id,
      interventionId,
      membership.id,
    ))
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(
      await leadershipRepository.approveIntervention({
        organizationId: identity.organization.id,
        interventionId,
        expectedLevel: level,
        actorUserId: actor.id,
        actorMembershipId: identity.membership.id,
        actorRole: identity.effectiveRole,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Approval failed" },
      { status: error instanceof LeadershipConflictError ? 409 : 400 },
    );
  }
}
