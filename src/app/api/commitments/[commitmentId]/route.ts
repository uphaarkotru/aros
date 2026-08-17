import { NextResponse } from "next/server";
import {
  getAuthenticatedIdentity,
  getRawSessionUser,
} from "@/auth/session.server";
import {
  cadenceRepository,
  CadenceConflictError,
} from "@/db/cadence-repository";
import { identityRepository } from "@/auth/repository.server";
import { getMembership } from "@/auth/tenant-model";
const commitmentStatuses = new Set([
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "MISSED",
  "CANCELLED",
]);
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commitmentId: string }> },
) {
  const identity = await getAuthenticatedIdentity(),
    actor = await getRawSessionUser();
  if (!identity || !actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!cadenceRepository)
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  let body: {
    expectedVersion?: number;
    status?: string;
    completionEvidence?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { commitmentId } = await params;
  const expectedVersion = Number(body.expectedVersion),
    status = String(body.status),
    effectiveMembership = getMembership(
      identityRepository,
      identity.viewUser.id,
      identity.organization.id,
    );
  if (!Number.isInteger(expectedVersion) || !commitmentStatuses.has(status))
    return NextResponse.json(
      { error: "Invalid or stale action-item update." },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await cadenceRepository.updateCommitment({
        organizationId: identity.organization.id,
        commitmentId,
        actorMembershipId: effectiveMembership?.id ?? identity.membership.id,
        actorUserId: actor.id,
        expectedVersion,
        status,
        completionEvidence: body.completionEvidence,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Commitment could not be updated",
      },
      { status: error instanceof CadenceConflictError ? 409 : 400 },
    );
  }
}
